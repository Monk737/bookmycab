import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { publishVersion, deleteDraft } from "@/lib/config/versions";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string; versionId: string }> }) {
  const { orgId, automationId, versionId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  const result = await publishVersion({ tenantId: orgId, automationId, versionId, publishedBy: gate.claims.sub });
  if (!result.ok) return NextResponse.json({ ok: false, violations: result.violations ?? [] }, { status: 422 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string; versionId: string }> }) {
  const { orgId, automationId, versionId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  await deleteDraft(orgId, versionId);
  return NextResponse.json({ ok: true });
}
