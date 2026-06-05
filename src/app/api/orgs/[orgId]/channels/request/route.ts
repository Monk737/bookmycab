import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { requestChannel } from "@/lib/channels/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "self_serve_channels");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await requestChannel({
    tenantId: orgId, type: String(b.type ?? ""), externalId: String(b.externalId ?? ""),
    automationId: String(b.automationId ?? ""), createdBy: gate.claims.sub,
  });
  if (!result.ok) return NextResponse.json({ error: "Invalid channel request.", fields: result.errors ?? [] }, { status: 422 });
  return NextResponse.json({ ok: true, id: result.id });
}
