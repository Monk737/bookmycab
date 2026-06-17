import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getProductOverview, type ChannelType, type SupabaseLike } from "./product-overview";
import { channelHealth } from "./queries";
import { CHAT_OUTCOMES, OUTCOME_LABEL, channelLabel, type ChatOutcome } from "./chat-format";
import type { CycleWindow } from "./billing-cycle";

/* ----------------------------------------------------------------------------
   Chat product analytics — multi-channel booking bot.

   Reads the conversations + channels tables and shapes them for the Chat
   surface: channel health, conversation volume + outcomes and the per-channel
   split. Pure reducers are unit-tested; the async loader wires them to the live
   schema. Client-safe label helpers live in ./chat-format.
   -------------------------------------------------------------------------- */

// Re-export the client-safe outcome enum + helpers for server-side consumers.
export { CHAT_OUTCOMES, chatOutcomeLabel, channelLabel, type ChatOutcome } from "./chat-format";

interface ConvoRow {
  channel_id: string | null;
  outcome: string | null;
  started_at: string;
  customer_handle: string | null;
  customer_name: string | null;
  via_voice?: boolean | null;
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

/** Pure: per-day conversation volume + booked across the window (gaps filled).
 *  When `startKey` (YYYY-MM-DD) is given, the window runs forward from it (a
 *  billing cycle); otherwise it trails back `rangeDays` from `now`. */
export function reduceChatTrend(rows: ConvoRow[], rangeDays: number, now = new Date(), startKey?: string): DayPoint[] {
  const byDay = new Map<string, { conversations: number; booked: number }>();
  if (startKey) {
    const start = new Date(`${startKey}T00:00:00Z`).getTime();
    for (let i = 0; i < rangeDays; i++) {
      byDay.set(new Date(start + i * 86_400_000).toISOString().slice(0, 10), { conversations: 0, booked: 0 });
    }
  } else {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      byDay.set(d, { conversations: 0, booked: 0 });
    }
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
  cycle?: CycleWindow,
): Promise<ChatAnalytics> {
  const supabase = client ?? (await createClient());
  const overview = await getProductOverview(tenantId, supabase, cycle);
  const since = new Date(Date.now() - (rangeDays - 1) * 86_400_000).toISOString().slice(0, 10);

  let convosQuery = supabase
    .from("conversations")
    .select("channel_id, outcome, started_at, customer_handle, customer_name, via_voice")
    .eq("tenant_id", tenantId);
  convosQuery = cycle
    ? convosQuery.gte("started_at", cycle.startIso).lt("started_at", cycle.endIso)
    : convosQuery.gte("started_at", `${since}T00:00:00Z`);

  const [convosRes, channelsRes] = await Promise.all([
    convosQuery.order("started_at", { ascending: false }),
    supabase
      .from("channels")
      .select("id, type, status, token_expires_at, external_id")
      .eq("tenant_id", tenantId),
  ]);

  const rows = (convosRes.data ?? []) as ConvoRow[];
  const channelRows = (channelsRes.data ?? []) as Record<string, unknown>[];

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

  return {
    hasChat: overview.chat != null,
    rangeDays: cycle ? cycle.days : rangeDays,
    tier: overview.chat?.tier ?? null,
    aggregate: reduceChatStats(rows),
    voiceNotes: rows.reduce((n, r) => n + (r.via_voice ? 1 : 0), 0),
    channels,
    trend: cycle ? reduceChatTrend(rows, cycle.days, undefined, cycle.periodStart) : reduceChatTrend(rows, rangeDays),
  };
}
