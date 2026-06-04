import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { claimConversation, releaseConversation } from "@/lib/liveops/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") === "release" ? "release" : "claim";
  const result = action === "release"
    ? await releaseConversation(orgId, conversationId)
    : await claimConversation(orgId, conversationId, gate.claims.sub);
  if (!result.ok) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ ok: true, status: result.status });
}
