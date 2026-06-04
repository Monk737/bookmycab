import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { dsarExport, dsarDelete } from "@/lib/crm/queries";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Owner" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "crm");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const handle = String(body.handle ?? "").trim();
  const action = String(body.action ?? "export");
  if (!handle) return NextResponse.json({ error: "handle is required." }, { status: 400 });
  if (action === "delete") {
    const result = await dsarDelete(orgId, handle);
    await writeAudit({
      actorUserId: gate.claims.sub,
      tenantId: orgId,
      action: "dsar.delete",
      targetType: "customer_handle",
      targetId: handle,
      metadata: { ok: result.ok, error: result.error ?? null },
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, action: "delete" });
  }
  await writeAudit({
    actorUserId: gate.claims.sub,
    tenantId: orgId,
    action: "dsar.export",
    targetType: "customer_handle",
    targetId: handle,
  });
  return NextResponse.json({ ok: true, action: "export", data: await dsarExport(orgId, handle) });
}
