import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Funnel, NamedValue, ZoneRow, HeatmapCell, AbandonmentRow, AnalyticsRange, VoiceStats } from "./analytics-types";

export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

export function reduceFunnel(convs: { outcome: string | null }[], bookingCount: number): Funnel {
  const inbound = convs.length;
  const reachedQuote = convs.filter((c) => c.outcome === "quoted" || c.outcome === "booked").length;
  const bookedConvs = convs.filter((c) => c.outcome === "booked").length;
  const intent = convs.filter((c) => c.outcome && c.outcome !== "unknown").length;
  // confirmed = conversations that reached a confirmed outcome; booked = actual
  // booking records written (the dispatch source of truth). They usually match;
  // bookingCount is authoritative for the final stage.
  return { inbound, greeted: inbound, intent, quoted: reachedQuote, confirmed: bookedConvs, booked: bookingCount || bookedConvs };
}

function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): NamedValue[] {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export const reduceChannelMix = (rows: { channel_id: string | null }[]) => countBy(rows, (r) => r.channel_id);
export const reduceModeSplit = (rows: { pickup_time_mode: string | null }[]) => countBy(rows, (r) => r.pickup_time_mode);
export const reduceVehicleSplit = (rows: { vehicle_type: string | null }[]) => countBy(rows, (r) => r.vehicle_type);

export function reduceTopZones(rows: { pickup_address?: unknown; destination_address?: unknown }[], field: "pickup_address" | "destination_address"): ZoneRow[] {
  const m = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const addr = r[field] as { zone?: string; town?: string } | null;
    const zone = addr?.zone ?? addr?.town;
    if (zone) { m.set(zone, (m.get(zone) ?? 0) + 1); total++; }
  }
  return [...m.entries()]
    .map(([zone, count]) => ({ zone, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function reduceHeatmap(rows: { created_at: string }[]): HeatmapCell[] {
  const grid: HeatmapCell[] = [];
  const idx = new Map<string, number>();
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) { idx.set(`${d}:${h}`, grid.length); grid.push({ day: d, hour: h, value: 0 }); }
  for (const r of rows) {
    const dt = new Date(r.created_at);
    if (Number.isNaN(dt.getTime())) continue;
    const cell = grid[idx.get(`${dt.getUTCDay()}:${dt.getUTCHours()}`)!];
    cell.value++;
  }
  return grid;
}

export function reduceAbandonment(rows: { abandonment_reason: string | null }[]): AbandonmentRow[] {
  const m = new Map<string, number>();
  for (const r of rows) { if (r.abandonment_reason) m.set(r.abandonment_reason, (m.get(r.abandonment_reason) ?? 0) + 1); }
  return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export function reduceVoiceStats(
  voiceMessages: { conversation_id: string; transcript: string | null }[],
  conversations: { id: string; outcome: string | null; language: string | null }[],
): VoiceStats {
  const totalVoiceNotes = voiceMessages.length;
  const voiceConvIds = new Set(voiceMessages.map((m) => m.conversation_id));
  const voiceConversations = voiceConvIds.size;
  const totalConversations = conversations.length;

  const transcribed = voiceMessages.filter((m) => (m.transcript ?? "").trim().length > 0);
  const transcribedPct = totalVoiceNotes ? Math.round((transcribed.length / totalVoiceNotes) * 100) : 0;
  const avgTranscriptChars = transcribed.length
    ? Math.round(transcribed.reduce((sum, m) => sum + (m.transcript ?? "").trim().length, 0) / transcribed.length)
    : 0;

  const voiceConvs = conversations.filter((c) => voiceConvIds.has(c.id));
  const bookedVoice = voiceConvs.filter((c) => c.outcome === "booked").length;
  const voiceBookingPct = voiceConversations ? Math.round((bookedVoice / voiceConversations) * 100) : 0;
  const voiceSharePct = totalConversations ? Math.round((voiceConversations / totalConversations) * 100) : 0;

  const langMap = new Map<string, number>();
  for (const c of voiceConvs) {
    const k = c.language ?? "unknown";
    langMap.set(k, (langMap.get(k) ?? 0) + 1);
  }
  const languages = [...langMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalVoiceNotes, voiceConversations, totalConversations,
    voiceSharePct, transcribedPct, voiceBookingPct, avgTranscriptChars, languages,
  };
}

export async function getFunnel(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<Funnel> {
  const supabase = client ?? (await createClient());
  let cq = supabase.from("conversations").select("outcome").eq("automation_id", automationId);
  if (r.from) cq = cq.gte("started_at", r.from);
  if (r.to) cq = cq.lte("started_at", r.to);
  const { data: convs } = await cq;
  // Apply the same date window to the authoritative bookings count so the final
  // funnel stage can't exceed the filtered inbound count for a narrow range.
  let bq = supabase.from("bookings").select("id", { count: "exact", head: true }).eq("automation_id", automationId);
  if (r.from) bq = bq.gte("created_at", r.from);
  if (r.to) bq = bq.lte("created_at", r.to);
  const { count } = await bq;
  return reduceFunnel((convs ?? []) as { outcome: string | null }[], count ?? 0);
}

export async function getChannelMix(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<NamedValue[]> {
  const supabase = client ?? (await createClient());
  let q = supabase.from("conversations").select("channel_id").eq("automation_id", automationId);
  if (r.from) q = q.gte("started_at", r.from);
  if (r.to) q = q.lte("started_at", r.to);
  const { data } = await q;
  return reduceChannelMix((data ?? []) as { channel_id: string | null }[]);
}

async function bookingsForAnalytics(automationId: string, r: AnalyticsRange, cols: string, supabase: SupabaseLike) {
  let q = supabase.from("bookings").select(cols).eq("automation_id", automationId);
  if (r.from) q = q.gte("created_at", r.from);
  if (r.to) q = q.lte("created_at", r.to);
  const { data } = await q;
  return data ?? [];
}

export async function getModeSplit(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<NamedValue[]> {
  const supabase = client ?? (await createClient());
  return reduceModeSplit((await bookingsForAnalytics(automationId, r, "pickup_time_mode", supabase)) as never);
}
export async function getVehicleSplit(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<NamedValue[]> {
  const supabase = client ?? (await createClient());
  return reduceVehicleSplit((await bookingsForAnalytics(automationId, r, "vehicle_type", supabase)) as never);
}
export async function getTopZones(automationId: string, r: AnalyticsRange, field: "pickup_address" | "destination_address", client?: SupabaseLike): Promise<ZoneRow[]> {
  const supabase = client ?? (await createClient());
  return reduceTopZones((await bookingsForAnalytics(automationId, r, field, supabase)) as never, field);
}
export async function getHeatmap(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<HeatmapCell[]> {
  const supabase = client ?? (await createClient());
  return reduceHeatmap((await bookingsForAnalytics(automationId, r, "created_at", supabase)) as never);
}
export async function getAbandonment(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<AbandonmentRow[]> {
  const supabase = client ?? (await createClient());
  let q = supabase.from("conversations").select("abandonment_reason").eq("automation_id", automationId);
  if (r.from) q = q.gte("started_at", r.from);
  if (r.to) q = q.lte("started_at", r.to);
  const { data } = await q;
  return reduceAbandonment((data ?? []) as { abandonment_reason: string | null }[]);
}
