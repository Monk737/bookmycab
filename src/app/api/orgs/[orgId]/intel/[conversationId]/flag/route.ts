import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { flagForReview } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await flagForReview(orgId, conversationId, Boolean(body.flagged));
  return NextResponse.json({ ok: true });
}
