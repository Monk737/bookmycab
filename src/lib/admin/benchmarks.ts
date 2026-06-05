import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface Percentiles { p25: number | null; p50: number | null; p75: number | null; sampleSize: number }

/** Pure: nearest-rank p25/p50/p75 of a numeric series. */
export function percentiles(values: number[]): Percentiles {
  if (values.length === 0) return { p25: null, p50: null, p75: null, sampleSize: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75), sampleSize: sorted.length };
}

export interface SnapshotRow { metric: string; p25: number | null; p50: number | null; p75: number | null; sample_size: number; computed_at: string }

/** Compute per-tenant metric values over the window for opted-in tenants, derive
 *  percentiles across tenants, and write one snapshot row per metric. */
export async function computeSnapshots(periodDays = 30): Promise<{ metrics: number }> {
  const sb = svc();
  const since = new Date(Date.now() - periodDays * 86400_000).toISOString();
  const { data: tenants } = await sb.from("tenants").select("id").eq("benchmark_opt_in", true);
  const tenantIds = (tenants ?? []).map((t) => t.id as string);
  if (tenantIds.length === 0) return { metrics: 0 };

  const revenue: number[] = [];
  const bookings: number[] = [];
  const abandonment: number[] = [];

  for (const id of tenantIds) {
    const { data: bk } = await sb.from("bookings").select("fare").eq("tenant_id", id).gte("created_at", since);
    const rows = bk ?? [];
    revenue.push(rows.reduce((s, r) => s + (Number(r.fare) || 0), 0));
    bookings.push(rows.length);
    const { data: cv } = await sb.from("conversations").select("outcome").eq("tenant_id", id).gte("started_at", since);
    const cvRows = cv ?? [];
    const rate = cvRows.length === 0 ? 0 : +((cvRows.filter((c) => c.outcome === "abandoned").length / cvRows.length) * 100).toFixed(1);
    abandonment.push(rate);
  }

  const metrics: Record<string, number[]> = { revenue_30d: revenue, bookings_30d: bookings, abandonment_pct: abandonment };
  for (const [metric, values] of Object.entries(metrics)) {
    const p = percentiles(values);
    await sb.from("benchmark_snapshots").insert({ metric, period_days: periodDays, p25: p.p25, p50: p.p50, p75: p.p75, sample_size: p.sampleSize });
  }
  return { metrics: Object.keys(metrics).length };
}

/** Latest snapshot per metric. */
export async function listSnapshots(): Promise<SnapshotRow[]> {
  const { data } = await svc().from("benchmark_snapshots").select("metric, p25, p50, p75, sample_size, computed_at").order("computed_at", { ascending: false });
  const seen = new Set<string>();
  const out: SnapshotRow[] = [];
  for (const r of (data ?? []) as SnapshotRow[]) {
    if (seen.has(r.metric)) continue;
    seen.add(r.metric);
    out.push(r);
  }
  return out;
}
