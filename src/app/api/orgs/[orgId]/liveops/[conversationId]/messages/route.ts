import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { getThread, postStaffMessage } from "@/lib/liveops/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  return NextResponse.json({ messages: await getThread(orgId, conversationId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  const result = await postStaffMessage({ tenantId: orgId, conversationId, userId: gate.claims.sub, text });
  if (!result.ok) {
    if (result.reason === "not_in_takeover") return NextResponse.json({ error: "Claim the conversation before replying." }, { status: 409 });
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, relayed: result.relayed });
}
