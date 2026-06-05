import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listDefinitions, createDefinition } from "@/lib/reporting/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  return NextResponse.json({ definitions: await listDefinitions(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const metrics = Array.isArray(b.metrics) ? (b.metrics as string[]).map(String) : [];
  if (!name || metrics.length === 0) return NextResponse.json({ error: "name and at least one metric are required." }, { status: 400 });
  await createDefinition(orgId, { name, metrics, format: typeof b.format === "string" ? b.format : undefined, whiteLabel: Boolean(b.whiteLabel), createdBy: gate.claims.sub });
  return NextResponse.json({ ok: true });
}
