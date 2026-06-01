import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getStatus } from "@/lib/engine/control";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; automationId: string }> },
) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json(await getStatus({ automationId }));
  } catch {
    return NextResponse.json({ error: "Status unavailable." }, { status: 502 });
  }
}
