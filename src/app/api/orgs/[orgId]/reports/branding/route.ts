import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { getBranding, setBranding } from "@/lib/reporting/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "white_label");
  if (feat) return feat;
  return NextResponse.json({ branding: await getBranding(orgId) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "white_label");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await setBranding(orgId, {
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : null,
    primary: typeof b.primary === "string" ? b.primary : undefined,
    accent: typeof b.accent === "string" ? b.accent : undefined,
  });
  return NextResponse.json({ ok: true });
}
