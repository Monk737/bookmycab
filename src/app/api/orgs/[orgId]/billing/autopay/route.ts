import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { getStripe } from "@/lib/billing/stripe";
import { toStripeCountry } from "@/lib/billing/country";

export const runtime = "nodejs";

/**
 * POST /api/orgs/:orgId/billing/autopay
 *
 * Starts a Stripe Checkout Session in `mode: "setup"` to capture and save a
 * default payment method for the tenant. On completion the webhook
 * (`checkout.session.completed`, reason `autopay_setup`) sets it as the
 * customer's default for invoices, so the prepaid monthly subscriptions
 * auto-charge each cycle. Returns `{ url }` for the client to redirect to.
 */
export async function POST(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;

  // Service-role client: provisioning the Stripe customer + persisting its id is
  // a cross-tenant billing write (RLS would block a tenant-scoped update here).
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: tenant, error } = await db
    .from("tenants")
    .select("id, name, contact_email, country, stripe_customer_id")
    .eq("id", orgId)
    .single();
  if (error || !tenant) {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }

  const stripe = getStripe();
  let customerId = tenant.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.name as string,
      email: (tenant.contact_email as string | null) ?? undefined,
      address: { country: toStripeCountry(tenant.country as string) },
      metadata: { tenant_id: orgId },
    });
    customerId = customer.id;
    await db.from("tenants").update({ stripe_customer_id: customerId }).eq("id", orgId);
  }

  try {
    const origin = new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      currency: "gbp",
      success_url: `${origin}/dashboard/billing?autopay=success`,
      cancel_url: `${origin}/dashboard/billing?autopay=cancelled`,
      metadata: { reason: "autopay_setup", tenant_id: orgId },
      setup_intent_data: { metadata: { reason: "autopay_setup", tenant_id: orgId } },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("autopay setup session failed", err);
    return NextResponse.json({ error: "Could not start payment setup." }, { status: 502 });
  }
}
