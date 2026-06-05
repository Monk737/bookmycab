import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { revokeKey } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; keyId: string }> }) {
  const { orgId, keyId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "api_access");
  if (feat) return feat;
  await revokeKey(orgId, keyId);
  return NextResponse.json({ ok: true });
}
