import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { deleteFareRule } from "@/lib/config/fare-queries";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string; ruleId: string }> }) {
  const { orgId, automationId, ruleId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "fare_rules");
  if (feat) return feat;
  void automationId;
  await deleteFareRule(orgId, ruleId);
  return NextResponse.json({ ok: true });
}
