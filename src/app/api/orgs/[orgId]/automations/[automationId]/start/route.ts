import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { startAutomation } from "@/lib/engine/control";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; automationId: string }> },
) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  try {
    await startAutomation({ automationId, tenantId: orgId, actorUserId: gate.claims.sub });
    return NextResponse.json({ ok: true, status: "live" });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not start the automation." }, { status: 502 });
  }
}
