import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { rollbackTo } from "@/lib/config/versions";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const versionId = String(body.versionId ?? "");
  if (!versionId) return NextResponse.json({ error: "versionId is required." }, { status: 400 });
  const result = await rollbackTo({ tenantId: orgId, automationId, versionId, userId: gate.claims.sub });
  if (!result.ok) return NextResponse.json({ ok: false, violations: result.violations ?? [] }, { status: 422 });
  return NextResponse.json({ ok: true });
}
