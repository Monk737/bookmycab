import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";

export async function POST(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;

  // Actual send is an engine concern; we acknowledge the request
  return NextResponse.json({ ok: true, queued: true });
}
