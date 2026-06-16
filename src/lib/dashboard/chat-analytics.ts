import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getProductOverview, type ChannelType, type SupabaseLike } from "./product-overview";
import { channelHealth } from "./queries";

/* ----------------------------------------------------------------------------
   Chat product analytics — multi-channel booking bot.

   Reads the conversations + channels tables and shapes them for the Chat
   surface: channel health, conversation volume + outcomes, per-channel split
   and a recent-conversation feed. Pure reducers are unit-tested; the async
   loader wires them to the live schema.
   -------------------------------------------------------------------------- */

export type ChatOutcome = "booked" | "quoted" | "managed" | "abandoned" | "cancelled" | "unknown";

export const CHAT_OUTCOMES: ChatOutcome[] = [
  "booked", "quoted", "managed", "abandoned", "cancelled", "unknown",
];

const OUTCOME_LABEL: Record<ChatOutcome, string> = {
  booked: "Booked",
  quoted: "Quoted",
  managed: "Managed",
  abandoned: "Abandoned",
  cancelled: "Cancelled",
  unknown: "Unknown",
};
export function chatOutcomeLabel(o: string): string {
  return OUTCOME_LABEL[o as ChatOutcome] ?? o;
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  widget: "Web widget",
};
export function channelLabel(t: string): string {
  return CHANNEL_LABEL[t] ?? t;
}

interface ConvoRow {
  channel_id: string | null;
  outcome: string | null;
  started_at: string;
  customer_handle: string | null;
  customer_name: string | null;
  via_voice?: boolean | null;
}

export interface ChatBookingRow {
  id: string;
  ref: string | null;
  who: string;
  pickup: string | null;
  destination: string | null;
  fare: string | null;
  status: string;
  createdAt: string;
}

export interface ChatStatBlock {
  totalConversations: number;
  booked: number;
  bookedPct: number;
  outcomes: { outcome: ChatOutcome; label: string; count: number }[];
}

export interface ChannelStat {
  type: ChannelType;
  label: string;
  health: "healthy" | "warning" | "disconnected";
  handle: string | null;
  conversations: number;
}

export interface DayPoint {
  date: string;
  conversations: number;
  booked: number;
}

export interface RecentConversation {
  who: string;
  channel: ChannelType | "unknown";
  outcome: ChatOutcome;
  startedAt: string;
}

export interface ChatAnalytics {
  hasChat: boolean;
  rangeDays: number;
  tier: string | null;
  aggregate: ChatStatBlock;
  /** Conversations in-window that involved a WhatsApp voice note (transcribed
   *  audio message, NOT a phone call). Analytics dimension only. */
  voiceNotes: number;
  channels: ChannelStat[];
  trend: DayPoint[];
  recent: RecentConversation[];
  recentBookings: ChatBookingRow[];
}

/** Pull a human-readable address line out of a stored address jsonb value. */
function addressLine(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v || null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const s = o.text ?? o.formatted ?? o.address ?? o.name;
    return typeof s === "string" && s.trim() ? s : null;
  }
  return null;
}

function formatFare(fare: unknown, currency: unknown): string | null {
  if (fare == null || fare === "") return null;
  const n = typeof fare === "number" ? fare : Number(fare);
  if (!Number.isFinite(n)) return null;
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return `${sym}${n.toFixed(2)}`;
}

function normaliseOutcome(o: string | null): ChatOutcome {
  return (CHAT_OUTCOMES as string[]).includes(o ?? "") ? (o as ChatOutcome) : "unknown";
}

/** Pure: reduce conversation rows to an aggregate outcome block. */
export function reduceChatStats(rows: ConvoRow[]): ChatStatBlock {
  const counts = new Map<ChatOutcome, number>();
  for (const r of rows) {
    const o = normaliseOutcome(r.outcome);
    counts.set(o, (counts.get(o) ?? 0) + 1);
  }
  const total = rows.length;
  const booked = counts.get("booked") ?? 0;
  return {
    totalConversations: total,
    booked,
    bookedPct: total > 0 ? Math.round((booked / total) * 100) : 0,
    outcomes: CHAT_OUTCOMES.map((o) => ({ outcome: o, label: OUTCOME_LABEL[o], count: counts.get(o) ?? 0 })).filter(
      (x) => x.count > 0,
    ),
  };
}

/** Pure: per-day conversation volume + booked across the window (gaps filled). */
export function reduceChatTrend(rows: ConvoRow[], rangeDays: number, now = new Date()): DayPoint[] {
  const byDay = new Map<string, { conversations: number; booked: number }>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { conversations: 0, booked: 0 });
  }
  for (const r of rows) {
    const cell = byDay.get(r.started_at.slice(0, 10));
    if (cell) {
      cell.conversations += 1;
      if (normaliseOutcome(r.outcome) === "booked") cell.booked += 1;
    }
  }
  return [...byDay.entries()].map(([date, v]) => ({ date, conversations: v.conversations, booked: v.booked }));
}

/** Pure: bucket conversations per channel using a channel_id -> type map. */
export function reduceByChannel(
  rows: ConvoRow[],
  channelTypeById: Map<string, ChannelType>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const type = r.channel_id ? channelTypeById.get(r.channel_id) : undefined;
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

/** Chat analytics for a tenant over the last `rangeDays` (default 30). */
export async function getChatAnalytics(
  tenantId: string,
  rangeDays = 30,
  client?: SupabaseLike,
): Promise<ChatAnalytics> {
  const supabase = client ?? (await createClient());
  const overview = await getProductOverview(tenantId, supabase);
  const since = new Date(Date.now() - (rangeDays - 1) * 86_400_000).toISOString().slice(0, 10);

  const [convosRes, channelsRes, bookingsRes] = await Promise.all([
    supabase
      .from("conversations")
      .select("channel_id, outcome, started_at, customer_handle, customer_name, via_voice")
      .eq("tenant_id", tenantId)
      .gte("started_at", `${since}T00:00:00Z`)
      .order("started_at", { ascending: false }),
    supabase
      .from("channels")
      .select("id, type, status, token_expires_at, external_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("bookings")
      .select(
        "id, dispatch_ref, passenger_name, customer_handle, pickup_address, destination_address, fare, currency, status, created_at",
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", `${since}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const rows = (convosRes.data ?? []) as ConvoRow[];
  const channelRows = (channelsRes.data ?? []) as Record<string, unknown>[];

  const recentBookings: ChatBookingRow[] = ((bookingsRes.data ?? []) as Record<string, unknown>[]).map((b) => ({
    id: b.id as string,
    ref: (b.dispatch_ref as string) ?? null,
    who: (b.passenger_name as string)?.trim() || (b.customer_handle as string) || "Unknown",
    pickup: addressLine(b.pickup_address),
    destination: addressLine(b.destination_address),
    fare: formatFare(b.fare, b.currency),
    status: (b.status as string) ?? "confirmed",
    createdAt: b.created_at as string,
  }));

  const typeById = new Map<string, ChannelType>();
  for (const c of channelRows) typeById.set(c.id as string, c.type as ChannelType);
  const perChannel = reduceByChannel(rows, typeById);

  const channels: ChannelStat[] = channelRows.map((c) => ({
    type: c.type as ChannelType,
    label: channelLabel(c.type as string),
    health: channelHealth(c.status as string, (c.token_expires_at as string) ?? null),
    handle: (c.external_id as string) ?? null,
    conversations: perChannel.get(c.type as string) ?? 0,
  }));
  // Busiest channel first; disconnected sinks down within equal volume.
  channels.sort((a, b) => b.conversations - a.conversations);

  const recent: RecentConversation[] = rows.slice(0, 8).map((r) => ({
    who: r.customer_name?.trim() || r.customer_handle || "Unknown caller",
    channel: (r.channel_id ? typeById.get(r.channel_id) : undefined) ?? "unknown",
    outcome: normaliseOutcome(r.outcome),
    startedAt: r.started_at,
  }));

  return {
    hasChat: overview.chat != null,
    rangeDays,
    tier: overview.chat?.tier ?? null,
    aggregate: reduceChatStats(rows),
    voiceNotes: rows.reduce((n, r) => n + (r.via_voice ? 1 : 0), 0),
    channels,
    trend: reduceChatTrend(rows, rangeDays),
    recent,
    recentBookings,
  };
}
