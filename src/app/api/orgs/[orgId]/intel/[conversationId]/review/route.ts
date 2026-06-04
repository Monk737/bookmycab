import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { submitReview } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const labels = ["good", "bad_understanding", "too_slow", "wrong_info", "other"];
  await submitReview({
    tenantId: orgId, conversationId, reviewerId: gate.claims.sub,
    rating: typeof b.rating === "number" ? b.rating : undefined,
    label: typeof b.label === "string" && labels.includes(b.label) ? b.label : undefined,
    note: typeof b.note === "string" ? b.note : undefined,
  });
  return NextResponse.json({ ok: true });
}
