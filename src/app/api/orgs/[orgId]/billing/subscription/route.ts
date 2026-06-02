import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBillingOverview } from "@/lib/dashboard/billing-queries";

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;

  const billing = await getBillingOverview(orgId);
  return NextResponse.json({ billing });
}
