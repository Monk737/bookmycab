import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { runReport, deleteDefinition } from "@/lib/reporting/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  const { orgId, reportId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  const result = await runReport(orgId, reportId);
  if (!result.ok) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true, report: result.report });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  const { orgId, reportId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  await deleteDefinition(orgId, reportId);
  return NextResponse.json({ ok: true });
}
