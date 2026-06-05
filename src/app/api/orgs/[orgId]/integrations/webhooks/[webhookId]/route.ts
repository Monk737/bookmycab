import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { deleteWebhook } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; webhookId: string }> }) {
  const { orgId, webhookId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "outbound_webhooks");
  if (feat) return feat;
  await deleteWebhook(orgId, webhookId);
  return NextResponse.json({ ok: true });
}
