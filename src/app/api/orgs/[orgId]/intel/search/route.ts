import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { searchConversations, listFlagged } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = q.trim() ? await searchConversations(orgId, q) : await listFlagged(orgId);
  return NextResponse.json({ conversations: results });
}
