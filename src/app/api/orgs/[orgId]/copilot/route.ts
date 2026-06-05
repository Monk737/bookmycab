import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireQuota } from "@/lib/entitlements/guard";
import { askCopilot, listHistory } from "@/lib/copilot/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const block = await requireQuota(gate.claims.tenant_id, "ai_copilot");
  if (block) return block;
  return NextResponse.json({ history: await listHistory(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const block = await requireQuota(gate.claims.tenant_id, "ai_copilot");
  if (block) return block;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const question = String(b.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  const result = await askCopilot(orgId, gate.claims.sub, question);
  return NextResponse.json({ ok: true, answer: result.answer, intent: result.intent });
}
