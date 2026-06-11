import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { getStripe } from "@/lib/billing/stripe";
import { getBillingOverview } from "@/lib/dashboard/billing-queries";
import { createClient } from "@/lib/supabase/server";
import { resolveTopupAmount } from "@/lib/billing/credit";
import { applyDiscount } from "@/lib/admin/coupons";
import { buildCreditCheckoutParams } from "@/lib/billing/credit-checkout";

export const runtime = "nodejs";

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;

  let body: { packId?: string; customGbp?: number; couponCode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Invalid request body.");
  }

  const packId = typeof body.packId === "string" ? body.packId : undefined;
  const customGbp = typeof body.customGbp === "number" ? body.customGbp : undefined;
  const couponCode =
    typeof body.couponCode === "string" && body.couponCode.trim()
      ? body.couponCode.trim()
      : undefined;

  const r = resolveTopupAmount({ packId, customGbp });
  if (!r.ok) return badRequest(r.error);

  let finalGbp = r.gbp;
  if (couponCode) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("validate_coupon", {
      p_code: couponCode,
      p_applies_to: "credit",
    });
    if (error) return badRequest("Could not check that coupon.");
    const percent = typeof data === "number" ? data : null;
    if (percent === null) return badRequest("Invalid or ineligible coupon.");
    finalGbp = applyDiscount(r.gbp, percent);
    // A 100%-off coupon would produce a £0 charge, which Stripe rejects for a
    // payment-mode line item. Reject it cleanly rather than letting the session
    // create throw a confusing 502. (Credits are never granted without payment.)
    if (finalGbp <= 0) {
      return badRequest("This coupon can't be applied to a credit top-up.");
    }
  }

  const billing = await getBillingOverview(orgId);
  if (!billing.stripeCustomerId) {
    return NextResponse.json(
      { error: "Billing is not set up for this account yet." },
      { status: 503 },
    );
  }

  try {
    const params = buildCreditCheckoutParams({
      customerId: billing.stripeCustomerId,
      tenantId: orgId,
      orgId,
      origin: new URL(req.url).origin,
      gbp: r.gbp,
      credits: r.credits,
      finalGbp,
      couponCode,
    });
    const session = await getStripe().checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("credit checkout session failed", err);
    return NextResponse.json({ error: "Could not start the top-up." }, { status: 502 });
  }
}
