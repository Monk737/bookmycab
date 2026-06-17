import "server-only";
import { createClient } from "@/lib/supabase/server";

/* ----------------------------------------------------------------------------
   Chat Intelligence — booking-centric insight for the WhatsApp Chatbot.

   Pure booking mechanics (no "agent quality"): where people travel, in what, when
   they book, what it's worth, and whether voice notes convert differently. All
   computed from the mirrored conversations + bookings the chat workflow wrote.
   -------------------------------------------------------------------------- */

/** Resolved analysis window for the intelligence page. */
export interface IntelWindow {
  sinceIso: string;
  untilIso: string;
  days: number;
  label: string;
  /** Echoed for the range picker's active state. */
  preset: "7" | "30" | "90" | "custom";
  from: string | null;
  to: string | null;
}

const PRESETS = new Set(["7", "30", "90"]);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Resolve ?days / ?from&?to search params into an analysis window. Defaults to
 *  the last 30 days; a valid from+to pair (YYYY-MM-DD) makes a custom range. */
export function resolveIntelWindow(params: { days?: string; from?: string; to?: string }): IntelWindow {
  const dre = /^\d{4}-\d{2}-\d{2}$/;
  const { from, to } = params;
  if (from && to && dre.test(from) && dre.test(to) && from <= to) {
    const sinceIso = `${from}T00:00:00.000Z`;
    const untilIso = `${to}T23:59:59.999Z`;
    const days = Math.max(1, Math.round((Date.parse(untilIso) - Date.parse(sinceIso)) / 86_400_000));
    const fmt = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return { sinceIso, untilIso, days, label: `${fmt(from)} – ${fmt(to)}`, preset: "custom", from, to };
  }
  const days = params.days && PRESETS.has(params.days) ? Number(params.days) : 30;
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  return {
    sinceIso: since.toISOString(),
    untilIso: until.toISOString(),
    days,
    label: `Last ${days} days`,
    preset: String(days) as "7" | "30" | "90",
    from: ymd(since),
    to: ymd(until),
  };
}

export interface ChatIntelligence {
  rangeDays: number;
  rangeLabel: string;
  hasData: boolean;
  totals: { conversations: number; booked: number; bookedPct: number; cancelled: number; failed: number };
  topRoutes: { label: string; count: number; avgFare: string | null }[];
  vehicleMix: { type: string; count: number; pct: number }[];
  /** All 24 hours in order (UK local), for the by-hour column chart. */
  hourly: { hour: number; count: number }[];
  weekdays: { wd: string; count: number }[];
  revenue: { totalGbp: number; avgFareGbp: number; bookings: number };
  voiceSplit: { voiceShare: number; voiceBookedPct: number; textBookedPct: number; voiceCount: number };
  repeatCustomers: { handle: string; bookings: number }[];
  timing: { asap: number; scheduled: number; avgLeadHours: number | null };
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** UK-local weekday index + hour for an instant. */
function londonCell(iso: string): { wd: number; hr: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", hour: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hr = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { wd: Math.max(0, WD.indexOf(wdName)), hr };
}

function addr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v || null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const s = o.text ?? o.formatted ?? o.address ?? o.name;
    return typeof s === "string" && s.trim() ? s : null;
  }
  return null;
}

type ConvRow = { outcome: string | null; via_voice: boolean | null; customer_handle: string | null };
type BookRow = {
  status: string | null;
  fare: number | string | null;
  vehicle_type: string | null;
  pickup_address: unknown;
  destination_address: unknown;
  created_at: string;
  pickup_at_utc: string | null;
  pickup_time_mode: string | null;
  customer_handle: string | null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function getChatIntelligence(tenantId: string, win: IntelWindow): Promise<ChatIntelligence> {
  const supabase = await createClient();

  const [{ data: convData }, { data: bookData }] = await Promise.all([
    supabase.from("conversations").select("outcome, via_voice, customer_handle")
      .eq("tenant_id", tenantId).gte("started_at", win.sinceIso).lte("started_at", win.untilIso),
    supabase.from("bookings")
      .select("status, fare, vehicle_type, pickup_address, destination_address, created_at, pickup_at_utc, pickup_time_mode, customer_handle")
      .eq("tenant_id", tenantId).gte("created_at", win.sinceIso).lte("created_at", win.untilIso),
  ]);

  const convos = (convData ?? []) as ConvRow[];
  const bookings = (bookData ?? []) as BookRow[];
  const live = bookings.filter((b) => b.status !== "cancelled");

  // Totals (conversation outcomes).
  const booked = convos.filter((c) => c.outcome === "booked").length;
  const totals = {
    conversations: convos.length,
    booked,
    bookedPct: convos.length ? Math.round((booked / convos.length) * 100) : 0,
    cancelled: convos.filter((c) => c.outcome === "cancelled").length,
    failed: convos.filter((c) => c.outcome === "failed").length,
  };

  // Top routes (+ average fare).
  const routeAgg = new Map<string, { count: number; fareSum: number; fareN: number }>();
  for (const b of live) {
    const p = addr(b.pickup_address);
    const d = addr(b.destination_address);
    if (!p || !d) continue;
    const key = `${p} → ${d}`;
    const cur = routeAgg.get(key) ?? { count: 0, fareSum: 0, fareN: 0 };
    cur.count += 1;
    const f = num(b.fare);
    if (f != null) { cur.fareSum += f; cur.fareN += 1; }
    routeAgg.set(key, cur);
  }
  const topRoutes = [...routeAgg.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 50)
    .map(([label, v]) => ({
      label,
      count: v.count,
      avgFare: v.fareN ? `£${(v.fareSum / v.fareN).toFixed(2)}` : null,
    }));

  // Vehicle mix.
  const vagg = new Map<string, number>();
  for (const b of live) {
    const t = (b.vehicle_type ?? "").trim() || "Unspecified";
    vagg.set(t, (vagg.get(t) ?? 0) + 1);
  }
  const vTotal = [...vagg.values()].reduce((s, n) => s + n, 0) || 1;
  const vehicleMix = [...vagg.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, pct: Math.round((count / vTotal) * 100) }));

  // Busiest booking hours + weekdays (UK time, by booking creation).
  const hourAgg = new Array(24).fill(0) as number[];
  const wdAgg = new Array(7).fill(0) as number[];
  for (const b of live) {
    const { wd, hr } = londonCell(b.created_at);
    hourAgg[hr] += 1;
    wdAgg[wd] += 1;
  }
  const hourly = hourAgg.map((count, hour) => ({ hour, count }));
  const weekdays = wdAgg.map((count, i) => ({ wd: WD[i], count }));

  // Revenue.
  let revSum = 0, revN = 0;
  for (const b of live) {
    const f = num(b.fare);
    if (f != null && f > 0) { revSum += f; revN += 1; }
  }
  const revenue = {
    totalGbp: Math.round(revSum),
    avgFareGbp: revN ? Math.round((revSum / revN) * 100) / 100 : 0,
    bookings: live.length,
  };

  // Voice vs text conversion (conversations).
  const voiceConvos = convos.filter((c) => c.via_voice);
  const textConvos = convos.filter((c) => !c.via_voice);
  const pct = (arr: ConvRow[]) => (arr.length ? Math.round((arr.filter((c) => c.outcome === "booked").length / arr.length) * 100) : 0);
  const voiceSplit = {
    voiceShare: convos.length ? Math.round((voiceConvos.length / convos.length) * 100) : 0,
    voiceBookedPct: pct(voiceConvos),
    textBookedPct: pct(textConvos),
    voiceCount: voiceConvos.length,
  };

  // Repeat customers (by booking phone).
  const custAgg = new Map<string, number>();
  for (const b of live) {
    const h = (b.customer_handle ?? "").trim();
    if (!h) continue;
    custAgg.set(h, (custAgg.get(h) ?? 0) + 1);
  }
  const repeatCustomers = [...custAgg.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([handle, bookings]) => ({ handle, bookings }));

  // Timing: ASAP vs scheduled, and average lead time for scheduled bookings.
  let asap = 0, scheduled = 0, leadSum = 0, leadN = 0;
  for (const b of live) {
    if (b.pickup_time_mode === "asap") {
      asap += 1;
    } else if (b.pickup_at_utc) {
      scheduled += 1;
      const lead = (new Date(b.pickup_at_utc).getTime() - new Date(b.created_at).getTime()) / 3_600_000;
      if (Number.isFinite(lead) && lead >= 0 && lead < 24 * 60) { leadSum += lead; leadN += 1; }
    }
  }
  const timing = {
    asap,
    scheduled,
    avgLeadHours: leadN ? Math.round((leadSum / leadN) * 10) / 10 : null,
  };

  return {
    rangeDays: win.days,
    rangeLabel: win.label,
    hasData: convos.length > 0 || bookings.length > 0,
    totals,
    topRoutes,
    vehicleMix,
    hourly,
    weekdays,
    revenue,
    voiceSplit,
    repeatCustomers,
    timing,
  };
}
