import "server-only";
import { createClient } from "@/lib/supabase/server";
import { periodBounds } from "@/lib/entitlements/meter";
import { channelHealth } from "./queries";

export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/* ----------------------------------------------------------------------------
   Two-product (Chat + AI Voice) dashboard data.

   The new commercial model: a tenant runs a Chat product (multi-channel bot) and
   /or an AI Voice product (one or more voice agents). These helpers read the new
   schema (chat_subscriptions, voice_subscriptions, voice_agents, calls,
   usage_counters, credit_ledger) and shape it for the overview + voice surfaces.
   Legacy tenants (commercial_model = null) resolve to a mostly-empty overview.
   -------------------------------------------------------------------------- */

export type ChannelType = "whatsapp" | "telegram" | "messenger" | "instagram" | "widget";
export type CallOutcome =
  | "booked" | "quoted" | "abandoned" | "transferred" | "failed" | "no_credit" | "unknown";

const TIER_LABEL: Record<string, string> = {
  ignition: "Ignition",
  in_motion: "In Motion",
  full_throttle: "Full Throttle",
};
export function tierLabel(tier: string | null): string {
  return tier ? TIER_LABEL[tier] ?? tier : "—";
}

export interface ChatChannelSummary {
  type: ChannelType;
  health: "healthy" | "warning" | "disconnected";
  handle: string | null;
}

export interface VoiceAgentSummary {
  id: string; // automation_id
  name: string;
  phone: string | null;
  status: string; // automations.status
}

export interface ProductOverview {
  commercialModel: "chat" | "voice" | "double_decker" | null;
  hasChat: boolean;
  hasVoice: boolean;
  currency: string;
  chat: {
    tier: string | null;
    channels: ChatChannelSummary[];
  } | null;
  voice: {
    tier: string | null;
    allowance: number;
    used: number;
    remaining: number;
    agents: VoiceAgentSummary[];
    creditBalance: number;
  } | null;
  phoneNumbers: string[];
}

/** Resolve the two-product overview for a tenant from the live schema. */
export async function getProductOverview(
  tenantId: string,
  client?: SupabaseLike,
): Promise<ProductOverview> {
  const supabase = client ?? (await createClient());
  const { start } = periodBounds("month", new Date());

  const [tenant, chatSub, channels, voiceSub, voiceAgents, counter, balance] = await Promise.all([
    supabase.from("tenants").select("commercial_model, currency").eq("id", tenantId).maybeSingle(),
    supabase.from("chat_subscriptions").select("plan_tier").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("channels").select("type, status, token_expires_at, external_id").eq("tenant_id", tenantId),
    supabase.from("voice_subscriptions").select("plan_tier, monthly_call_allowance").eq("tenant_id", tenantId).maybeSingle(),
    supabase
      .from("voice_agents")
      .select("automation_id, display_name, phone_number, automations(status)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("usage_counters")
      .select("used")
      .eq("tenant_id", tenantId)
      .eq("feature_key", "voice_calls")
      .eq("period_start", start)
      .maybeSingle(),
    supabase.rpc("credit_balance", { p_tenant: tenantId }),
  ]);

  const commercialModel = (tenant.data?.commercial_model ?? null) as ProductOverview["commercialModel"];
  const currency = (tenant.data?.currency as string) ?? "GBP";
  const hasChat = commercialModel === "chat" || commercialModel === "double_decker";
  const hasVoice = commercialModel === "voice" || commercialModel === "double_decker";

  const chatChannels: ChatChannelSummary[] = ((channels.data ?? []) as Record<string, unknown>[]).map((c) => ({
    type: c.type as ChannelType,
    health: channelHealth(c.status as string, (c.token_expires_at as string) ?? null),
    handle: (c.external_id as string) ?? null,
  }));

  const agents: VoiceAgentSummary[] = ((voiceAgents.data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: a.automation_id as string,
    name: (a.display_name as string) ?? "Voice agent",
    phone: (a.phone_number as string) ?? null,
    status: ((a.automations as { status?: string } | null)?.status as string) ?? "building",
  }));

  const allowance = (voiceSub.data?.monthly_call_allowance as number) ?? 0;
  const used = (counter.data?.used as number) ?? 0;
  const creditBalance =
    typeof balance.data === "number" ? balance.data : Number(balance.data ?? 0);

  // Phone numbers in use: voice agent numbers + chat channel handles that look
  // like phone numbers (WhatsApp). De-duplicate, drop blanks.
  const numbers = new Set<string>();
  for (const a of agents) if (a.phone) numbers.add(a.phone);
  for (const c of chatChannels) if (c.type === "whatsapp" && c.handle) numbers.add(c.handle);

  return {
    commercialModel,
    hasChat,
    hasVoice,
    currency,
    chat: hasChat || chatSub.data || chatChannels.length > 0
      ? {
          tier: (chatSub.data?.plan_tier as string) ?? null,
          channels: chatChannels,
        }
      : null,
    voice: hasVoice || voiceSub.data || agents.length > 0
      ? {
          tier: (voiceSub.data?.plan_tier as string) ?? null,
          allowance,
          used,
          remaining: Math.max(0, allowance - used),
          agents,
          creditBalance,
        }
      : null,
    phoneNumbers: [...numbers],
  };
}

/* ----------------------------------------------------------------------------
   Voice analytics — per-agent + aggregate from the append-only `calls` table.
   -------------------------------------------------------------------------- */

export const CALL_OUTCOMES: CallOutcome[] = [
  "booked", "quoted", "transferred", "abandoned", "failed", "no_credit", "unknown",
];

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: "Booked",
  quoted: "Quoted",
  transferred: "Transferred",
  abandoned: "Abandoned",
  failed: "Failed",
  no_credit: "No credit",
  unknown: "Unknown",
};
export function outcomeLabel(o: string): string {
  return OUTCOME_LABEL[o as CallOutcome] ?? o;
}

interface CallRow {
  automation_id: string;
  outcome: string;
  duration_s: number | null;
  credit_source: string;
  started_at: string;
}

export interface VoiceStatBlock {
  totalCalls: number;
  booked: number;
  bookedPct: number;
  avgDurationS: number;
  outcomes: { outcome: CallOutcome; label: string; count: number }[];
  creditSplit: { plan: number; topup: number; none: number };
}

export interface VoiceAgentAnalytics extends VoiceStatBlock {
  agentId: string;
  name: string;
  phone: string | null;
  status: string;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD
  calls: number;
  booked: number;
}

export interface VoiceAnalytics {
  hasVoice: boolean;
  rangeDays: number;
  allowance: number;
  used: number;
  remaining: number;
  creditBalance: number;
  currency: string;
  aggregate: VoiceStatBlock;
  perAgent: VoiceAgentAnalytics[];
  trend: DayPoint[];
}

/** Pure: reduce a set of call rows into an aggregate stat block. */
export function reduceCallStats(rows: CallRow[]): VoiceStatBlock {
  const total = rows.length;
  const counts = new Map<string, number>();
  let durationSum = 0;
  let durationN = 0;
  const creditSplit = { plan: 0, topup: 0, none: 0 };
  for (const r of rows) {
    counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
    if (typeof r.duration_s === "number") {
      durationSum += r.duration_s;
      durationN += 1;
    }
    if (r.credit_source === "plan") creditSplit.plan += 1;
    else if (r.credit_source === "topup") creditSplit.topup += 1;
    else creditSplit.none += 1;
  }
  const booked = counts.get("booked") ?? 0;
  return {
    totalCalls: total,
    booked,
    bookedPct: total > 0 ? Math.round((booked / total) * 100) : 0,
    avgDurationS: durationN > 0 ? Math.round(durationSum / durationN) : 0,
    outcomes: CALL_OUTCOMES.map((o) => ({ outcome: o, label: OUTCOME_LABEL[o], count: counts.get(o) ?? 0 })).filter(
      (x) => x.count > 0,
    ),
    creditSplit,
  };
}

/** Pure: bucket calls into a per-day trend across the window (fills gaps with 0). */
export function reduceDayTrend(rows: CallRow[], rangeDays: number, now = new Date()): DayPoint[] {
  const byDay = new Map<string, { calls: number; booked: number }>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { calls: 0, booked: 0 });
  }
  for (const r of rows) {
    const d = r.started_at.slice(0, 10);
    const cell = byDay.get(d);
    if (cell) {
      cell.calls += 1;
      if (r.outcome === "booked") cell.booked += 1;
    }
  }
  return [...byDay.entries()].map(([date, v]) => ({ date, calls: v.calls, booked: v.booked }));
}

/** Voice analytics for a tenant over the last `rangeDays` (default 30). */
export async function getVoiceAnalytics(
  tenantId: string,
  rangeDays = 30,
  client?: SupabaseLike,
): Promise<VoiceAnalytics> {
  const supabase = client ?? (await createClient());
  const overview = await getProductOverview(tenantId, supabase);
  const since = new Date(Date.now() - (rangeDays - 1) * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("calls")
    .select("automation_id, outcome, duration_s, credit_source, started_at")
    .eq("tenant_id", tenantId)
    .gte("started_at", `${since}T00:00:00Z`);

  const rows = ((data ?? []) as CallRow[]);
  const agents = overview.voice?.agents ?? [];

  const perAgent: VoiceAgentAnalytics[] = agents.map((agent) => {
    const agentRows = rows.filter((r) => r.automation_id === agent.id);
    return { agentId: agent.id, name: agent.name, phone: agent.phone, status: agent.status, ...reduceCallStats(agentRows) };
  });

  return {
    hasVoice: overview.voice != null,
    rangeDays,
    allowance: overview.voice?.allowance ?? 0,
    used: overview.voice?.used ?? 0,
    remaining: overview.voice?.remaining ?? 0,
    creditBalance: overview.voice?.creditBalance ?? 0,
    currency: overview.currency,
    aggregate: reduceCallStats(rows),
    perAgent,
    trend: reduceDayTrend(rows, rangeDays),
  };
}

/** Format seconds as m:ss (call durations). */
export function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
