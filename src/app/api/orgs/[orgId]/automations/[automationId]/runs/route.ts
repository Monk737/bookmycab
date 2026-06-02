import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { listRuns } from "@/lib/engine/control";
import { neutralRunStatus } from "@/lib/engine/types";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string; automationId: string }> },
) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;

  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(100, Math.max(1, Math.trunc(raw))) : 50;

  try {
    const runs = await listRuns({ automationId }, limit);
    // Remap each run's status to customer-neutral vocabulary before returning.
    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        finished: r.finished,
        status: neutralRunStatus(r.status),
        startedAt: r.startedAt,
        stoppedAt: r.stoppedAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Runs unavailable." }, { status: 502 });
  }
}
