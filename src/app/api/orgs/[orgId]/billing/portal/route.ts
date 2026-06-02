import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { env } from "@/env";
import { getStripe } from "@/lib/billing/stripe";
import { getBillingOverview } from "@/lib/dashboard/billing-queries";

export async function POST(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;

  // Reuse the RLS-scoped overview to get the customer id — no service-role key
  // on this customer-facing route.
  const billing = await getBillingOverview(orgId);
  if (!billing.stripeCustomerId) {
    return new NextResponse(
      JSON.stringify({ error: "Billing portal is not available yet." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing portal session failed", err);
    return new NextResponse(
      JSON.stringify({ error: "Could not open the billing portal." }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}
