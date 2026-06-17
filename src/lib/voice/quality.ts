import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CycleWindow } from "@/lib/dashboard/billing-cycle";

export interface HandleTrendPoint { date: string; avgS: number; calls: number; }
export interface FailCluster { when: string; count: number; }

export interface AgentPerformance {
  totalCalls: number;
  transferred: number;
  containmentPct: number;
  successPct: number;
  successSample: number;
  avgHandleS: number;
  handleTrend: HandleTrendPoint[];
  failedTotal: number;
  failClusters: FailCluster[];
}

export interface ReviewCall {
  id: string;
  startedAt: string;
  caller: string | null;
  callerName: string | null;
  outcome: string;
  durationS: number | null;
  reasons: string[];
  severity: number;
  hasRecording: boolean;
  synopsis: string | null;
}

export interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  sampled: number;
  trend: { date: string; positive: number; neutral: number; negative: number }[];
}

export interface LoyaltyData {
  newCallers: number;
  returningCallers: number;
  repeat: { caller: string; calls: number; lastAt: string }[];
}

export interface RecentCallMeta {
  id: string;
  startedAt: string;
  caller: string | null;
  callerName: string | null;
  outcome: string;
  durationS: number | null;
  hasRecording: boolean;
  synopsis: string | null;
  // Quality signals surfaced on the card (Agent quality page).
  sentiment: string | null;
  success: boolean | null;
  addressLookups: number | null;
  /** Triage flags + severity (empty = clean call), and whether it's been actioned. */
  reasons: string[];
  severity: number;
  reviewed: boolean;
}

export interface VoiceQuality {
  rangeDays: number;
  performance: AgentPerformance;
  review: ReviewCall[];
  sentiment: SentimentData;
  loyalty: LoyaltyData;
  recent: RecentCallMeta[];
}

type Row = {
  id: string;
  started_at: string;
  outcome: string;
  duration_s: number | null;
  success: boolean | null;
  caller_number: string | null;
  caller_name: string | null;
  sentiment: string | null;
  address_lookups: number | null;
  recording_url: string | null;
  summary: string | null;
};

const LONG_CALL_S = 300; // 5 minutes
const RELOOKUP_THRESHOLD = 4; // lookup_address called this many+ times = address struggle
const dayKey = (iso: string) => iso.slice(0, 10);

/** Flags + severity for a struggled call. Empty array = not flagged. */
function reviewReasons(r: Row): { reasons: string[]; severity: number } {
  const reasons: string[] = [];
  let severity = 0;
  if (r.outcome === "failed") { reasons.push("System error"); severity += 4; }
  if (r.outcome === "abandoned") { reasons.push("Caller abandoned"); severity += 3; }
  if ((r.address_lookups ?? 0) >= RELOOKUP_THRESHOLD) { reasons.push("Repeated address confusion"); severity += 3; }
  if ((r.duration_s ?? 0) > LONG_CALL_S) { reasons.push("Unusually long"); severity += 1; }
  if (r.success === false && r.outcome !== "failed" && r.outcome !== "abandoned") { reasons.push("Goal not met"); severity += 2; }
  return { reasons, severity };
}

/** AI-quality + self-improvement data for a tenant over the last `rangeDays`. */
export async function getVoiceQuality(tenantId: string, rangeDays = 30, cycle?: CycleWindow): Promise<VoiceQuality> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - rangeDays * 86_400_000).toISOString();

  let query = supabase
    .from("calls")
    .select("id, started_at, outcome, duration_s, success, caller_number, caller_name, sentiment, address_lookups, recording_url, summary")
    .eq("tenant_id", tenantId);
  query = cycle
    ? query.gte("started_at", cycle.startIso).lt("started_at", cycle.endIso)
    : query.gte("started_at", sinceIso);

  // Reviewed/dismissed calls drop out of the triage queue. Fetched in parallel;
  // if the call_reviews table isn't present yet the error is swallowed and the
  // queue simply shows everything (graceful until migration 0062 is applied).
  const [callsRes, reviewsRes] = await Promise.all([
    query.order("started_at", { ascending: false }),
    supabase.from("call_reviews").select("call_id").eq("tenant_id", tenantId).in("status", ["reviewed", "dismissed"]),
  ]);
  const data = callsRes.data;
  const actioned = new Set(((reviewsRes.data ?? []) as { call_id: string }[]).map((x) => x.call_id));

  // Day buckets for the mini-trends: the selected cycle, or the trailing 14 days.
  const dayKeys: string[] = [];
  if (cycle) {
    const startMs = new Date(`${cycle.periodStart}T00:00:00Z`).getTime();
    for (let i = 0; i < cycle.days; i++) dayKeys.push(new Date(startMs + i * 86_400_000).toISOString().slice(0, 10));
  } else {
    for (let i = 13; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  }

  const rows = (data ?? []) as Row[];
  const total = rows.length;

  // ---- Performance ----
  const transferred = rows.filter((r) => r.outcome === "transferred").length;
  const successRows = rows.filter((r) => r.success != null);
  const successYes = successRows.filter((r) => r.success === true).length;
  const durRows = rows.filter((r) => typeof r.duration_s === "number");
  const avgHandleS = durRows.length ? Math.round(durRows.reduce((s, r) => s + (r.duration_s ?? 0), 0) / durRows.length) : 0;

  const trendMap = new Map<string, { sum: number; n: number; calls: number }>();
  for (const k of dayKeys) trendMap.set(k, { sum: 0, n: 0, calls: 0 });
  for (const r of rows) {
    const cell = trendMap.get(dayKey(r.started_at));
    if (cell) { cell.calls += 1; if (typeof r.duration_s === "number") { cell.sum += r.duration_s; cell.n += 1; } }
  }
  const handleTrend: HandleTrendPoint[] = [...trendMap.entries()].map(([date, v]) => ({
    date, avgS: v.n ? Math.round(v.sum / v.n) : 0, calls: v.calls,
  }));

  // Operational health: failure clusters by hour bucket.
  const failed = rows.filter((r) => r.outcome === "failed");
  const hourBuckets = new Map<string, number>();
  for (const r of failed) {
    const k = r.started_at.slice(0, 13); // YYYY-MM-DDTHH
    hourBuckets.set(k, (hourBuckets.get(k) ?? 0) + 1);
  }
  const failClusters: FailCluster[] = [...hourBuckets.entries()]
    .filter(([, n]) => n >= 3)
    .map(([k, count]) => ({
      when: new Date(`${k}:00:00Z`).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const performance: AgentPerformance = {
    totalCalls: total,
    transferred,
    containmentPct: total > 0 ? Math.round(((total - transferred) / total) * 100) : 0,
    successPct: successRows.length ? Math.round((successYes / successRows.length) * 100) : 0,
    successSample: successRows.length,
    avgHandleS,
    handleTrend,
    failedTotal: failed.length,
    failClusters,
  };

  // ---- Calls to review ---- (open items only; reviewed/dismissed drop out)
  const review: ReviewCall[] = rows
    .filter((r) => !actioned.has(r.id))
    .map((r) => {
      const { reasons, severity } = reviewReasons(r);
      return reasons.length
        ? {
            id: r.id, startedAt: r.started_at, caller: r.caller_number, callerName: r.caller_name,
            outcome: r.outcome, durationS: r.duration_s, reasons, severity,
            hasRecording: !!r.recording_url, synopsis: r.summary,
          }
        : null;
    })
    .filter((x): x is ReviewCall => x !== null)
    .sort((a, b) => b.severity - a.severity || (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 100);

  // ---- Sentiment ----
  const sCount = { positive: 0, neutral: 0, negative: 0 };
  const sTrend = new Map<string, { positive: number; neutral: number; negative: number }>();
  for (const k of dayKeys) sTrend.set(k, { positive: 0, neutral: 0, negative: 0 });
  for (const r of rows) {
    if (r.sentiment === "positive" || r.sentiment === "neutral" || r.sentiment === "negative") {
      sCount[r.sentiment] += 1;
      const cell = sTrend.get(dayKey(r.started_at));
      if (cell) cell[r.sentiment] += 1;
    }
  }
  const sentiment: SentimentData = {
    ...sCount,
    sampled: sCount.positive + sCount.neutral + sCount.negative,
    trend: [...sTrend.entries()].map(([date, v]) => ({ date, ...v })),
  };

  // ---- Loyalty ----
  const byCaller = new Map<string, { calls: number; lastAt: string }>();
  for (const r of rows) {
    if (!r.caller_number) continue;
    const c = byCaller.get(r.caller_number) ?? { calls: 0, lastAt: r.started_at };
    c.calls += 1;
    if (r.started_at > c.lastAt) c.lastAt = r.started_at;
    byCaller.set(r.caller_number, c);
  }
  let newCallers = 0, returningCallers = 0;
  for (const v of byCaller.values()) {
    if (v.calls > 1) returningCallers++; else newCallers++;
  }
  const repeat = [...byCaller.entries()]
    .filter(([, v]) => v.calls > 1)
    .map(([caller, v]) => ({ caller, calls: v.calls, lastAt: v.lastAt }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 6);

  const loyalty: LoyaltyData = { newCallers, returningCallers, repeat };

  // ---- Recent (quality browse) — full window, each carrying its triage flags
  // so the Call Inspector can filter to flagged calls and action them inline. ----
  const recent: RecentCallMeta[] = rows.slice(0, 300).map((r) => {
    const { reasons, severity } = reviewReasons(r);
    return {
      id: r.id, startedAt: r.started_at, caller: r.caller_number, callerName: r.caller_name,
      outcome: r.outcome, durationS: r.duration_s, hasRecording: !!r.recording_url, synopsis: r.summary,
      sentiment: r.sentiment, success: r.success, addressLookups: r.address_lookups,
      reasons, severity, reviewed: actioned.has(r.id),
    };
  });

  return { rangeDays: cycle ? cycle.days : rangeDays, performance, review, sentiment, loyalty, recent };
}
