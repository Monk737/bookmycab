import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { updateAccount, deleteAccount } from "@/lib/invoicing/service";

export const runtime = "nodejs";

async function gateAll(orgId: string) {
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return { res: gate as NextResponse };
  const demo = blockIfDemo(gate.claims);
  if (demo) return { res: demo };
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return { res: feat };
  return { res: null };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; accountId: string }> }) {
  const { orgId, accountId } = await params;
  const { res } = await gateAll(orgId);
  if (res) return res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await updateAccount(orgId, accountId, {
    name: typeof b.name === "string" ? b.name : undefined,
    billingEmail: typeof b.billingEmail === "string" ? b.billingEmail : undefined,
    creditTerms: typeof b.creditTerms === "number" ? b.creditTerms : undefined,
    markupPct: typeof b.markupPct === "number" ? b.markupPct : undefined,
    active: typeof b.active === "boolean" ? b.active : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; accountId: string }> }) {
  const { orgId, accountId } = await params;
  const { res } = await gateAll(orgId);
  if (res) return res;
  await deleteAccount(orgId, accountId);
  return NextResponse.json({ ok: true });
}
