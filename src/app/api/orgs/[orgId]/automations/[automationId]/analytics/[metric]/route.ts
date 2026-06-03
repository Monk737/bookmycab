import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import {
  getFunnel,
  getChannelMix,
  getModeSplit,
  getVehicleSplit,
  getTopZones,
  getHeatmap,
  getAbandonment,
  getVoiceStats,
} from "@/lib/dashboard/analytics";
import type { AnalyticsRange } from "@/lib/dashboard/analytics-types";
import { getResponseStats, getRevenueSummary } from "@/lib/dashboard/insights";

type MetricFn = (id: string, range: AnalyticsRange) => Promise<unknown>;

const METRICS: Record<string, MetricFn> = {
  funnel: (id, r) => getFunnel(id, r),
  channels: (id, r) => getChannelMix(id, r),
  mode: (id, r) => getModeSplit(id, r),
  vehicle: (id, r) => getVehicleSplit(id, r),
  zones: (id, r) => getTopZones(id, r, "pickup_address"),
  destinations: (id, r) => getTopZones(id, r, "destination_address"),
  heatmap: (id, r) => getHeatmap(id, r),
  abandonment: (id, r) => getAbandonment(id, r),
  voice: (id, r) => getVoiceStats(id, r),
  "response-time": (id, r) => getResponseStats(id, r),
  revenue: (id, r) => getRevenueSummary(id, r),
};

const STUB_METRICS = new Set<string>([]);

export async function GET(req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId, metric } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;

  if (STUB_METRICS.has(metric)) {
    return NextResponse.json({ available: false, reason: "Available once message-timing capture is enabled." });
  }

  const fn = METRICS[metric];
  if (!fn) {
    return NextResponse.json({ error: "Unknown metric" }, { status: 404 });
  }

  const url = new URL(req.url);
  const range: AnalyticsRange = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const data = await fn(automationId, range);
  return NextResponse.json({ metric, data });
}
