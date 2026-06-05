import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listAccounts, createAccount } from "@/lib/invoicing/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  return NextResponse.json({ accounts: await listAccounts(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Account name is required." }, { status: 400 });
  await createAccount(orgId, {
    name, billingEmail: typeof b.billingEmail === "string" ? b.billingEmail : undefined,
    creditTerms: Number(b.creditTerms) || undefined, markupPct: Number(b.markupPct) || 0,
  });
  return NextResponse.json({ ok: true });
}
