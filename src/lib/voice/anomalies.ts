import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface Anomaly {
  kind: "failure_spike" | "cancellation_spike" | "booked_drop";
  severity: "high" | "medium";
  headline: string;
  detail: string;
}

type Row = { started_at: string; outcome: string };

const MIN_VOLUME = 20; // booked-rate drop only meaningful with enough calls both weeks
const SPIKE_FLOOR = 5; // ignore tiny absolute counts

function pct(rows: Row[], outcome: string): number {
  return rows.length ? Math.round((rows.filter((r) => r.outcome === outcome).length / rows.length) * 100) : 0;
}
const times = (now: number, prev: number) => (prev === 0 ? "up from 0" : `${(now / prev).toFixed(1)}× vs last week`);

/**
 * Compare the last 7 days to the 7 before it and surface anomalies for the
 * dashboard banner: a spike in failures or cancellations, or a drop in the
 * booked rate. Computed on read, so an alert clears itself once the week
 * recovers — no stored state to manage.
 */
export async function getVoiceAnomalies(tenantId: string): Promise<Anomaly[]> {
  const supabase = await createClient();
  const now = Date.now();
  const weekStart = new Date(now - 7 * 86_400_000).toISOString();
  const priorStart = new Date(now - 14 * 86_400_000).toISOString();

  const { data } = await supabase
    .from("calls")
    .select("started_at, outcome")
    .eq("tenant_id", tenantId)
    .gte("started_at", priorStart);

  const rows = (data ?? []) as Row[];
  const week = rows.filter((r) => r.started_at >= weekStart);
  const prev = rows.filter((r) => r.started_at < weekStart);

  const out: Anomaly[] = [];

  const failedNow = week.filter((r) => r.outcome === "failed").length;
  const failedPrev = prev.filter((r) => r.outcome === "failed").length;
  if (failedNow >= SPIKE_FLOOR && failedNow >= 2 * failedPrev) {
    out.push({
      kind: "failure_spike",
      severity: failedNow >= 10 || failedNow >= 3 * Math.max(1, failedPrev) ? "high" : "medium",
      headline: `Failed calls ${times(failedNow, failedPrev)}`,
      detail: `${failedNow} calls failed this week (was ${failedPrev}). Often an upstream outage rather than the agent — worth a check with your build team.`,
    });
  }

  const cxlNow = week.filter((r) => r.outcome === "cancelled").length;
  const cxlPrev = prev.filter((r) => r.outcome === "cancelled").length;
  if (cxlNow >= SPIKE_FLOOR && cxlNow >= 2 * cxlPrev) {
    out.push({
      kind: "cancellation_spike",
      severity: cxlNow >= 3 * Math.max(1, cxlPrev) ? "high" : "medium",
      headline: `Cancellations ${times(cxlNow, cxlPrev)}`,
      detail: `${cxlNow} bookings cancelled this week (was ${cxlPrev}).`,
    });
  }

  if (week.length >= MIN_VOLUME && prev.length >= MIN_VOLUME) {
    const bookedNow = pct(week, "booked");
    const bookedPrev = pct(prev, "booked");
    const drop = bookedPrev - bookedNow;
    if (drop >= 15) {
      out.push({
        kind: "booked_drop",
        severity: drop >= 25 ? "high" : "medium",
        headline: `Booked rate down ${drop} points`,
        detail: `${bookedNow}% of calls booked this week, down from ${bookedPrev}% last week.`,
      });
    }
  }

  return out;
}
