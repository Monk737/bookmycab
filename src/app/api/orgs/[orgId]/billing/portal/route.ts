import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";

export async function POST(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;

  return new NextResponse(
    JSON.stringify({ error: "Billing portal is being set up." }),
    { status: 503, headers: { "content-type": "application/json" } },
  );
}
