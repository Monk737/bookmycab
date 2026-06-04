import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listFareRules, upsertFareRule } from "@/lib/config/fare-queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "fare_rules");
  if (feat) return feat;
  return NextResponse.json({ rules: await listFareRules(orgId, automationId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "fare_rules");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const vehicle_type = String(b.vehicle_type ?? "").trim();
  if (!vehicle_type) return NextResponse.json({ error: "vehicle_type is required." }, { status: 400 });
  const num = (k: string) => { const n = Number(b[k]); return Number.isFinite(n) ? n : 0; };
  await upsertFareRule(orgId, automationId, {
    vehicle_type, base_fare: num("base_fare"), per_mile: num("per_mile"), per_min: num("per_min"),
    min_fare: num("min_fare"), airport_surcharge: num("airport_surcharge"), currency: String(b.currency ?? "GBP"),
  });
  return NextResponse.json({ ok: true });
}
