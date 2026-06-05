import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { setInvoiceStatus } from "@/lib/invoicing/service";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; invoiceId: string }> }) {
  const { orgId, invoiceId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(b.status ?? "");
  if (!["issued", "paid", "void"].includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  await setInvoiceStatus(orgId, invoiceId, status as "issued" | "paid" | "void");
  return NextResponse.json({ ok: true });
}
