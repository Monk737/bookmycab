import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { createRule, listRules } from "@/lib/alerting/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  return NextResponse.json({ rules: await listRules(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const metric = String(body.metric ?? "");
  const operator = String(body.operator ?? "");
  const threshold = Number(body.threshold);
  if (!name || !metric || !["gt", "gte", "lt", "lte"].includes(operator) || Number.isNaN(threshold)) {
    return NextResponse.json({ error: "name, metric, operator and threshold are required." }, { status: 400 });
  }
  await createRule(orgId, {
    name, metric, operator: operator as "gt" | "gte" | "lt" | "lte", threshold,
    window_hours: Number(body.window_hours) || 24,
    severity: (["info", "warning", "critical"].includes(String(body.severity)) ? String(body.severity) : "warning") as string,
    automation_id: (body.automation_id as string) ?? null,
    createdBy: gate.claims.sub,
  });
  return NextResponse.json({ ok: true });
}
