import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getAutomationCards } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const cards = await getAutomationCards(orgId);
  const card = cards.find((c) => c.id === automationId);
  if (!card) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ automation: card });
}
