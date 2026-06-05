import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listWebhooks, createWebhook } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "outbound_webhooks");
  if (feat) return feat;
  return NextResponse.json({ webhooks: await listWebhooks(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "outbound_webhooks");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(b.url ?? "").trim();
  const events = Array.isArray(b.events) ? (b.events as string[]).map(String) : [];
  if (!url || events.length === 0) return NextResponse.json({ error: "url and at least one event are required." }, { status: 400 });
  await createWebhook(orgId, url, events);
  return NextResponse.json({ ok: true });
}
