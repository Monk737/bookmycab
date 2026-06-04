import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { retryDispatch } from "@/lib/dispatchops/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string; bookingId: string }> }) {
  const { orgId, bookingId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "dispatch_retry");
  if (feat) return feat;
  const result = await retryDispatch(orgId, bookingId);
  if (!result.ok) {
    if (result.error === "not_found") return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    return NextResponse.json({ ok: false, error: result.error ?? "Retry failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
