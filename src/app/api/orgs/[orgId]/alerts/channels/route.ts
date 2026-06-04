import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { createChannel, listChannels } from "@/lib/alerting/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  return NextResponse.json({ channels: await listChannels(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const type = String(body.type ?? "");
  const destination = String(body.destination ?? "").trim();
  if (!["email", "slack", "webhook"].includes(type) || !destination) {
    return NextResponse.json({ error: "type and destination are required." }, { status: 400 });
  }
  await createChannel(orgId, type, destination);
  return NextResponse.json({ ok: true });
}
