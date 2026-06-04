import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { evaluateAlerts } from "@/lib/alerting/engine";

export const runtime = "nodejs";

/** POST: run alert evaluation for this tenant now. Admin-gated; intended for a
 *  scheduled job calling per-tenant. */
export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  const summary = await evaluateAlerts(orgId);
  return NextResponse.json({ ok: true, ...summary });
}
