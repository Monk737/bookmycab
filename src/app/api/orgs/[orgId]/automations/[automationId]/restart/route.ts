import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { restartAutomation } from "@/lib/engine/control";

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
    await restartAutomation({ automationId, tenantId: orgId, actorUserId: gate.claims.sub });
    return NextResponse.json({ ok: true, status: "live" });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not restart the automation." }, { status: 502 });
  }
}
