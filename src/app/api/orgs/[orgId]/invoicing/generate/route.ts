import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { generateInvoice } from "@/lib/invoicing/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accountId = String(b.accountId ?? "");
  const periodStart = String(b.periodStart ?? "");
  const periodEnd = String(b.periodEnd ?? "");
  if (!accountId || !periodStart || !periodEnd) return NextResponse.json({ error: "accountId, periodStart and periodEnd are required." }, { status: 400 });
  const result = await generateInvoice(orgId, accountId, periodStart, periodEnd);
  if (!result.id) return NextResponse.json({ error: "No account bookings in that period." }, { status: 422 });
  return NextResponse.json({ ok: true, invoiceId: result.id, total: result.total });
}
