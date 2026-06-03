import "server-only";
import { createClient } from "@/lib/supabase/server";
import { percentile } from "@/lib/observability/percentile";
import type { TrendPoint, ResponseStats, RevenueSummary } from "./insights-types";

export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const DAY_MS = 86_400_000;
function dayKey(iso: string | Date): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function shortLabel(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Builds a per-day axis from `from`..`to` (inclusive) with current + previous counts. */
export function reduceDailyTrend(
  current: { created_at: string }[],
  previous: { created_at: string }[],
  from: string,
  to: string,
): TrendPoint[] {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.max(0, Math.round((end - start) / DAY_MS)) + 1;

  const axis: { key: string; current: number; previous: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(start + i * DAY_MS));
    idx.set(key, i);
    axis.push({ key, current: 0, previous: 0 });
  }
  for (const r of current) {
    const i = idx.get(dayKey(r.created_at));
    if (i !== undefined) axis[i].current++;
  }
  // Previous window is the `days` days immediately before `from`; align by offset.
  const prevStart = start - days * DAY_MS;
  for (const r of previous) {
    const offset = Math.floor((new Date(r.created_at).getTime() - prevStart) / DAY_MS);
    if (offset >= 0 && offset < days) axis[offset].previous++;
  }
  return axis.map((a) => ({ label: shortLabel(a.key), current: a.current, previous: a.previous }));
}

/** First-response seconds per conversation: first inbound → next outbound after it. */
export function reduceResponseStats(
  messages: { conversation_id: string; direction: string; ts: string }[],
): ResponseStats {
  const byConv = new Map<string, { direction: string; ts: number }[]>();
  for (const m of messages) {
    const arr = byConv.get(m.conversation_id) ?? [];
    arr.push({ direction: m.direction, ts: new Date(m.ts).getTime() });
    byConv.set(m.conversation_id, arr);
  }
  const deltas: number[] = [];
  for (const arr of byConv.values()) {
    arr.sort((a, b) => a.ts - b.ts);
    const firstInbound = arr.find((m) => m.direction === "inbound");
    if (!firstInbound) continue;
    const reply = arr.find((m) => m.direction === "outbound" && m.ts >= firstInbound.ts);
    if (!reply) continue;
    deltas.push(Math.round((reply.ts - firstInbound.ts) / 1000));
  }
  if (deltas.length === 0) return { sampleSize: 0, avgSeconds: 0, p50Seconds: 0, p95Seconds: 0 };
  const avg = Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length);
  return {
    sampleSize: deltas.length,
    avgSeconds: avg,
    p50Seconds: percentile(deltas, 50),
    p95Seconds: percentile(deltas, 95),
  };
}

export function reduceRevenue(bookings: { fare: number | null; status: string }[]): RevenueSummary {
  const bookingCount = bookings.length;
  const fares = bookings.map((b) => (typeof b.fare === "number" ? b.fare : null)).filter((f): f is number => f !== null);
  const totalFare = Math.round(fares.reduce((s, f) => s + f, 0));
  const avgFare = fares.length ? Math.round(totalFare / fares.length) : 0;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const completionPct = bookingCount ? Math.round((completedCount / bookingCount) * 100) : 0;
  const statusMap = new Map<string, number>();
  for (const b of bookings) statusMap.set(b.status, (statusMap.get(b.status) ?? 0) + 1);
  const byStatus = [...statusMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return { totalFare, avgFare, completedCount, bookingCount, completionPct, byStatus };
}

// ——— async getters (mirror analytics.ts) ———————————————————————

interface Range { from?: string; to?: string }

function defaultRange(r: Range): { from: string; to: string } {
  const to = r.to ?? new Date().toISOString().slice(0, 10);
  const from = r.from ?? dayKey(new Date(Date.now() - 29 * DAY_MS));
  return { from, to };
}

export async function getBookingsTrend(automationId: string, r: Range, client?: SupabaseLike): Promise<TrendPoint[]> {
  const supabase = client ?? (await createClient());
  const { from, to } = defaultRange(r);
  const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS) + 1;
  const prevFrom = dayKey(new Date(new Date(`${from}T00:00:00Z`).getTime() - days * DAY_MS));
  const toEnd = `${to}T23:59:59.999Z`;
  const fromStart = `${from}T00:00:00Z`;
  const [{ data: cur }, { data: prev }] = await Promise.all([
    supabase.from("bookings").select("created_at").eq("automation_id", automationId).gte("created_at", fromStart).lte("created_at", toEnd),
    supabase.from("bookings").select("created_at").eq("automation_id", automationId).gte("created_at", `${prevFrom}T00:00:00Z`).lt("created_at", fromStart),
  ]);
  return reduceDailyTrend((cur ?? []) as { created_at: string }[], (prev ?? []) as { created_at: string }[], from, to);
}

export async function getRevenueSummary(automationId: string, r: Range, client?: SupabaseLike): Promise<RevenueSummary> {
  const supabase = client ?? (await createClient());
  let q = supabase.from("bookings").select("fare, status").eq("automation_id", automationId);
  if (r.from) q = q.gte("created_at", `${r.from}T00:00:00Z`);
  if (r.to) q = q.lte("created_at", `${r.to}T23:59:59.999Z`);
  const { data } = await q;
  return reduceRevenue((data ?? []) as { fare: number | null; status: string }[]);
}

export async function getResponseStats(automationId: string, r: Range, client?: SupabaseLike): Promise<ResponseStats> {
  const supabase = client ?? (await createClient());
  let cq = supabase.from("conversations").select("id").eq("automation_id", automationId);
  if (r.from) cq = cq.gte("started_at", `${r.from}T00:00:00Z`);
  if (r.to) cq = cq.lte("started_at", `${r.to}T23:59:59.999Z`);
  const { data: convs } = await cq;
  const ids = (convs ?? []).map((c) => (c as { id: string }).id);
  if (ids.length === 0) return reduceResponseStats([]);
  // Bound the message scan to the analytics window and order by ts so the
  // first-response pairing is correct and the default PostgREST 1000-row cap
  // can't silently truncate a busy tenant's sample.
  let mq = supabase.from("messages").select("conversation_id, direction, ts").in("conversation_id", ids);
  if (r.from) mq = mq.gte("ts", `${r.from}T00:00:00Z`);
  if (r.to) mq = mq.lte("ts", `${r.to}T23:59:59.999Z`);
  const { data: msgs } = await mq.order("ts", { ascending: true }).limit(20000);
  return reduceResponseStats((msgs ?? []) as { conversation_id: string; direction: string; ts: string }[]);
}
