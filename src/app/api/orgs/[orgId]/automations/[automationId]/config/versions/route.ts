import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listVersions, createDraft, getLiveConfig } from "@/lib/config/versions";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  return NextResponse.json({ versions: await listVersions(automationId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const config = (body.config as Record<string, unknown>) ?? (await getLiveConfig(automationId)) ?? {};
  const draft = await createDraft({ tenantId: orgId, automationId, config, changeNote: typeof body.changeNote === "string" ? body.changeNote : undefined, createdBy: gate.claims.sub });
  return NextResponse.json({ ok: true, ...draft });
}
