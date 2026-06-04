import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { setRuleEnabled, deleteRule } from "@/lib/alerting/queries";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; ruleId: string }> }) {
  const { orgId, ruleId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await setRuleEnabled(orgId, ruleId, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; ruleId: string }> }) {
  const { orgId, ruleId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  await deleteRule(orgId, ruleId);
  return NextResponse.json({ ok: true });
}
