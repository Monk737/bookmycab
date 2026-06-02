import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getAutomationCards } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const automations = await getAutomationCards(orgId);
  return NextResponse.json({ automations });
}
