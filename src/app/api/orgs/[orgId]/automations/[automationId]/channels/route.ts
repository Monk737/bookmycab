import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getChannels } from "@/lib/dashboard/channels-queries";

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;

  const channels = await getChannels(automationId);
  return NextResponse.json({ channels });
}
