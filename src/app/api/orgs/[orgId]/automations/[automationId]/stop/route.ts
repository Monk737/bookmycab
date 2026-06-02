import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { stopAutomation } from "@/lib/engine/control";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; automationId: string }> },
) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demoBlock = blockIfDemo(gate.claims);
  if (demoBlock) return demoBlock;
  try {
    await stopAutomation({ automationId, tenantId: orgId, actorUserId: gate.claims.sub });
    return NextResponse.json({ ok: true, status: "stopped" });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not stop the automation." }, { status: 502 });
  }
}
