import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getMessages } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId, conversationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const messages = await getMessages(conversationId);
  return NextResponse.json({ messages });
}
