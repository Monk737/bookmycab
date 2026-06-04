import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { getCustomer, getCustomerBookings, listNotes, setCustomerFlags } from "@/lib/crm/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; customerId: string }> }) {
  const { orgId, customerId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "crm");
  if (feat) return feat;
  const customer = await getCustomer(orgId, customerId);
  if (!customer) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [bookings, notes] = await Promise.all([getCustomerBookings(orgId, customer.customer_handle), listNotes(orgId, customerId)]);
  return NextResponse.json({ customer, bookings, notes });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; customerId: string }> }) {
  const { orgId, customerId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "crm");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await setCustomerFlags(orgId, customerId, {
    vip: typeof body.vip === "boolean" ? body.vip : undefined,
    blocked: typeof body.blocked === "boolean" ? body.blocked : undefined,
  });
  return NextResponse.json({ ok: true });
}
