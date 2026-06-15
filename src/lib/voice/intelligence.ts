import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RecoveryStatus = "pending" | "contacted" | "recovered" | "dismissed";

export interface RecoveryItem {
  recoveryId: string;
  callId: string;
  startedAt: string;
  caller: string | null;
  callerName: string | null;
  pickup: string | null;
  destination: string | null;
  quotedFare: number | null;
  vehicleType: string | null;
  outcome: string;
  reason: string | null;
  status: RecoveryStatus;
  note: string | null;
}

export interface HeatCell {
  wd: number; // 0=Sun..6=Sat
  hr: number; // 0..23
  count: number;
}

export interface FunnelData {
  total: number;
  engaged: number; // reached a quote (quoted + booked)
  booked: number;
  quoted: number;
  abandoned: number;
  failed: number;
  managed: number; // modified + cancelled
  quoteToBookPct: number;
  abandonmentPct: number;
}

export interface RouteItem { label: string; count: number; revenue: number; }
export interface AirportItem { code: string; count: number; }
export interface VehicleItem { type: string; count: number; }

export interface VoiceIntelligence {
  rangeDays: number;
  recovery: {
    items: RecoveryItem[];
    recoverable: number;
    recoveredValue: number;
    recoveredCount: number;
    dismissedCount: number;
  };
  heatmap: { cells: HeatCell[]; max: number; total: number; peak: { wd: number; hr: number; count: number } | null };
  funnel: FunnelData;
  routes: { top: RouteItem[]; airports: AirportItem[]; vehicles: VehicleItem[] };
}

const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const londonFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});

/** London-local weekday index + hour for an ISO timestamp (UK firms read demand in local time). */
function londonCell(iso: string): { wd: number; hr: number } {
  const parts = londonFmt.formatToParts(new Date(iso));
  const wd = WD_INDEX[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 1;
  let hr = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  if (!Number.isFinite(hr) || hr === 24) hr = 0;
  return { wd, hr };
}

type CallRow = {
  id: string;
  started_at: string;
  outcome: string;
  caller_number: string | null;
  pickup: string | null;
  destination: string | null;
  quoted_fare: number | null;
  vehicle_type: string | null;
  airport_code: string | null;
  booking_ref: string | null;
};

const VEHICLE_LABEL: Record<string, string> = {
  saloon: "Saloon",
  estate: "Estate",
  mpv: "MPV (6)",
  "8seater": "8-seater",
  wheelchair: "Wheelchair",
};

/** All four Tier 1 intelligence datasets for a tenant over the last `rangeDays`. */
export async function getVoiceIntelligence(
  tenantId: string,
  rangeDays = 30,
): Promise<VoiceIntelligence> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - rangeDays * 86_400_000).toISOString();

  const [callsRes, recoveryRes] = await Promise.all([
    supabase
      .from("calls")
      .select("id, started_at, outcome, caller_number, pickup, destination, quoted_fare, vehicle_type, airport_code, booking_ref")
      .eq("tenant_id", tenantId)
      .gte("started_at", sinceIso),
    supabase
      .from("voice_call_recovery")
      .select("id, status, note, call_id, calls!inner(id, started_at, caller_number, caller_name, pickup, destination, quoted_fare, vehicle_type, outcome, abandon_reason)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  const calls = (callsRes.data ?? []) as CallRow[];

  // ---- Recovery worklist ----
  type RecRow = {
    id: string;
    status: RecoveryStatus;
    note: string | null;
    call_id: string;
    calls: {
      id: string; started_at: string; caller_number: string | null; caller_name: string | null; pickup: string | null;
      destination: string | null; quoted_fare: number | null; vehicle_type: string | null; outcome: string; abandon_reason: string | null;
    };
  };
  const recRows = (recoveryRes.data ?? []) as unknown as RecRow[];
  const REASON_FALLBACK: Record<string, string> = { quoted: "Quoted, didn't book", abandoned: "Abandoned mid-call" };
  const items: RecoveryItem[] = recRows
    .filter((r) => r.status === "pending" || r.status === "contacted")
    .map((r) => ({
      recoveryId: r.id,
      callId: r.call_id,
      startedAt: r.calls.started_at,
      caller: r.calls.caller_number,
      callerName: r.calls.caller_name,
      pickup: r.calls.pickup,
      destination: r.calls.destination,
      quotedFare: r.calls.quoted_fare != null ? Number(r.calls.quoted_fare) : null,
      vehicleType: r.calls.vehicle_type,
      outcome: r.calls.outcome,
      reason: r.calls.abandon_reason || REASON_FALLBACK[r.calls.outcome] || null,
      status: r.status,
      note: r.note,
    }))
    .sort((a, b) => (b.quotedFare ?? 0) - (a.quotedFare ?? 0) || (a.startedAt < b.startedAt ? 1 : -1));

  const recoverable = items.reduce((s, i) => s + (i.quotedFare ?? 0), 0);
  const recovered = recRows.filter((r) => r.status === "recovered");
  const recoveredValue = recovered.reduce((s, r) => s + (r.calls.quoted_fare != null ? Number(r.calls.quoted_fare) : 0), 0);

  // ---- Demand heatmap ----
  const cellMap = new Map<string, number>();
  for (const c of calls) {
    const { wd, hr } = londonCell(c.started_at);
    const k = `${wd}-${hr}`;
    cellMap.set(k, (cellMap.get(k) ?? 0) + 1);
  }
  const cells: HeatCell[] = [...cellMap.entries()].map(([k, count]) => {
    const [wd, hr] = k.split("-").map(Number);
    return { wd, hr, count };
  });
  let max = 0;
  let peak: { wd: number; hr: number; count: number } | null = null;
  for (const c of cells) {
    if (c.count > max) { max = c.count; peak = c; }
  }

  // ---- Booking funnel ----
  const by = (o: string) => calls.filter((c) => c.outcome === o).length;
  const booked = by("booked");
  const quoted = by("quoted");
  const abandoned = by("abandoned");
  const failed = by("failed");
  const managed = by("modified") + by("cancelled");
  const engaged = booked + quoted;
  const total = calls.length;
  const funnel: FunnelData = {
    total,
    engaged,
    booked,
    quoted,
    abandoned,
    failed,
    managed,
    quoteToBookPct: engaged > 0 ? Math.round((booked / engaged) * 100) : 0,
    abandonmentPct: total > 0 ? Math.round((abandoned / total) * 100) : 0,
  };

  // ---- Routes / airports / vehicles ----
  const routeMap = new Map<string, { count: number; revenue: number }>();
  const airportMap = new Map<string, number>();
  const vehicleMap = new Map<string, number>();
  for (const c of calls) {
    if (c.pickup && c.destination) {
      const label = `${c.pickup.split(",")[0]} → ${c.destination.split(",")[0]}`;
      const r = routeMap.get(label) ?? { count: 0, revenue: 0 };
      r.count += 1;
      if (c.quoted_fare != null) r.revenue += Number(c.quoted_fare);
      routeMap.set(label, r);
    }
    if (c.airport_code) airportMap.set(c.airport_code, (airportMap.get(c.airport_code) ?? 0) + 1);
    if (c.vehicle_type && (c.outcome === "booked" || c.outcome === "quoted")) {
      vehicleMap.set(c.vehicle_type, (vehicleMap.get(c.vehicle_type) ?? 0) + 1);
    }
  }
  const top: RouteItem[] = [...routeMap.entries()]
    .map(([label, v]) => ({ label, count: v.count, revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, 6);
  const airports: AirportItem[] = [...airportMap.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  const vehicles: VehicleItem[] = [...vehicleMap.entries()]
    .map(([type, count]) => ({ type: VEHICLE_LABEL[type] ?? type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    rangeDays,
    recovery: {
      items,
      recoverable: Math.round(recoverable),
      recoveredValue: Math.round(recoveredValue),
      recoveredCount: recovered.length,
      dismissedCount: recRows.filter((r) => r.status === "dismissed").length,
    },
    heatmap: { cells, max, total, peak },
    funnel,
    routes: { top, airports, vehicles },
  };
}
