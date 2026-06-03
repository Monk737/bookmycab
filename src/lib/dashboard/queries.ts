import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  OrgSummary, AutomationCard, KpiStrip, BookingRow, BookingDetail,
  ConversationRow, ConversationDetail, MessageRow,
} from "./types";
import type { BookingFilter, ConversationFilter } from "./bookings-filter";

export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

export function reduceOrgKpis(bookings: { fare: number | null; status: string }[]): { bookings30d: number; revenue30d: number } {
  const revenue30d = Math.round(
    bookings.reduce((s, b) => s + (typeof b.fare === "number" ? b.fare : 0), 0),
  );
  return { bookings30d: bookings.length, revenue30d };
}

export async function getOrgKpis(tenantId: string, client?: SupabaseLike): Promise<{ bookings30d: number; revenue30d: number }> {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase.from("bookings").select("fare, status").eq("tenant_id", tenantId).gte("created_at", since);
  return reduceOrgKpis((data ?? []) as { fare: number | null; status: string }[]);
}

function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function getOrgSummary(tenantId: string, client?: SupabaseLike): Promise<OrgSummary | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("tenants").select("id, name, plan_band, contract_renewal, currency").eq("id", tenantId).maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, planBand: data.plan_band, contractRenewal: data.contract_renewal, currency: data.currency };
}

export async function getKpiStrip(tenantId: string, client?: SupabaseLike): Promise<KpiStrip> {
  const supabase = client ?? (await createClient());
  const since = startOfTodayUtcIso();
  const [bookings, convs, live] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("started_at", since),
    supabase.from("automations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "live"),
  ]);
  return { bookingsToday: bookings.count ?? 0, conversationsToday: convs.count ?? 0, liveAutomations: live.count ?? 0 };
}

/** Health from channel status + token expiry: red disconnected/error, amber <=7d, else green. */
export function channelHealth(status: string, tokenExpiresAt: string | null): "healthy" | "warning" | "disconnected" {
  if (status === "disconnected" || status === "error") return "disconnected";
  if (tokenExpiresAt) {
    const days = (new Date(tokenExpiresAt).getTime() - Date.now()) / 86_400_000;
    if (days <= 7) return "warning";
  }
  return "healthy";
}

export async function getAutomationCards(tenantId: string, client?: SupabaseLike): Promise<AutomationCard[]> {
  const supabase = client ?? (await createClient());
  const since = startOfTodayUtcIso();
  const { data: autos } = await supabase
    .from("automations")
    .select("id, name, type, status, dispatch_adapter, channels(type, status, token_expires_at)")
    .eq("tenant_id", tenantId).order("created_at", { ascending: true });
  const cards: AutomationCard[] = [];
  for (const a of (autos ?? []) as Record<string, unknown>[]) {
    const [b, c] = await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("automation_id", a.id as string).gte("created_at", since),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("automation_id", a.id as string).gte("started_at", since),
    ]);
    const bookingsToday = b.count ?? 0;
    const conversationsToday = c.count ?? 0;
    const channels = ((a.channels as { type: string; status: string; token_expires_at: string | null }[]) ?? []).map((ch) => ({
      type: ch.type as AutomationCard["channels"][number]["type"],
      health: channelHealth(ch.status, ch.token_expires_at),
    }));
    cards.push({
      id: a.id as string, name: a.name as string, type: a.type as AutomationCard["type"],
      status: a.status as AutomationCard["status"], dispatchAdapter: (a.dispatch_adapter as string) ?? null,
      channels, bookingsToday, conversationsToday,
      conversionPct: conversationsToday > 0 ? Math.round((bookingsToday / conversationsToday) * 100) : 0,
    });
  }
  return cards;
}

const BOOKING_COLS =
  "id, dispatch_ref, pickup_at_utc, passenger_name, customer_handle, channel_type, pickup_address, destination_address, vehicle_type, passenger_count, fare, currency, status, pickup_time_mode";

function mapBookingRow(r: Record<string, unknown>): BookingRow {
  return {
    id: r.id as string, dispatchRef: (r.dispatch_ref as string) ?? null, pickupAtUtc: (r.pickup_at_utc as string) ?? null,
    passengerName: (r.passenger_name as string) ?? null, customerHandle: (r.customer_handle as string) ?? null,
    channelType: (r.channel_type as string) ?? null, pickupAddress: r.pickup_address ?? null,
    destinationAddress: r.destination_address ?? null, vehicleType: (r.vehicle_type as string) ?? null,
    passengerCount: (r.passenger_count as number) ?? null, fare: (r.fare as number) ?? null,
    currency: (r.currency as string) ?? "GBP", status: (r.status as BookingRow["status"]) ?? "confirmed",
    pickupTimeMode: (r.pickup_time_mode as string) ?? null,
  };
}

export async function getBookingsPage(
  args: { automationId: string; filter: BookingFilter }, client?: SupabaseLike,
): Promise<{ rows: BookingRow[]; total: number }> {
  const supabase = client ?? (await createClient());
  const { automationId, filter } = args;
  let q = supabase.from("bookings").select(BOOKING_COLS, { count: "exact" }).eq("automation_id", automationId);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.channel) q = q.eq("channel_type", filter.channel);
  if (filter.mode) q = q.eq("pickup_time_mode", filter.mode);
  if (filter.from) q = q.gte("pickup_at_utc", filter.from);
  if (filter.to) q = q.lte("pickup_at_utc", filter.to);
  if (filter.search) q = q.ilike("passenger_name", `%${filter.search}%`);
  const start = (filter.page - 1) * filter.limit;
  q = q.order("pickup_at_utc", { ascending: false, nullsFirst: false }).range(start, start + filter.limit - 1);
  const { data, count } = await q;
  return { rows: ((data ?? []) as Record<string, unknown>[]).map(mapBookingRow), total: count ?? 0 };
}

export async function getBookingDetail(bookingId: string, client?: SupabaseLike): Promise<BookingDetail | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase.from("bookings")
    .select(`${BOOKING_COLS}, driver_note, airport_json, conversation_id, raw_dispatch_json, created_at`)
    .eq("id", bookingId).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    ...mapBookingRow(r), driverNote: (r.driver_note as string) ?? null, airportJson: r.airport_json ?? null,
    conversationId: (r.conversation_id as string) ?? null, rawDispatchJson: r.raw_dispatch_json ?? null,
    createdAt: r.created_at as string,
  };
}

/**
 * Updates a booking's status, scoped to BOTH the booking id AND its automation.
 * The automation_id constraint prevents a restriction-scoped Admin from mutating
 * a sibling automation's booking in the same tenant by passing an allowed
 * automationId in the URL with another automation's bookingId (RLS only checks
 * tenant on the bookings UPDATE policy). Returns true only when a row matched.
 */
export async function updateBookingStatus(
  bookingId: string,
  automationId: string,
  status: BookingRow["status"],
  client?: SupabaseLike,
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("automation_id", automationId)
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

const CONVERSATION_COLS = "id, customer_name, customer_handle, channel_id, started_at, ended_at, outcome, language";

export async function getConversationsPage(
  args: { automationId: string; filter: ConversationFilter }, client?: SupabaseLike,
): Promise<{ rows: ConversationRow[]; total: number }> {
  const supabase = client ?? (await createClient());
  const { automationId, filter } = args;
  let q = supabase.from("conversations").select(CONVERSATION_COLS, { count: "exact" }).eq("automation_id", automationId);
  if (filter.outcome) q = q.eq("outcome", filter.outcome);
  if (filter.language) q = q.eq("language", filter.language);
  if (filter.channel) q = q.eq("channel_id", filter.channel);
  if (filter.from) q = q.gte("started_at", filter.from);
  if (filter.to) q = q.lte("started_at", filter.to);
  if (filter.search) q = q.ilike("customer_name", `%${filter.search}%`);
  const start = (filter.page - 1) * filter.limit;
  q = q.order("started_at", { ascending: false }).range(start, start + filter.limit - 1);
  const { data, count } = await q;
  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, customerName: (r.customer_name as string) ?? null, customerHandle: r.customer_handle as string,
      channelId: (r.channel_id as string) ?? null, startedAt: r.started_at as string, endedAt: (r.ended_at as string) ?? null,
      outcome: (r.outcome as ConversationRow["outcome"]) ?? null, language: (r.language as string) ?? null, messageCount: 0,
    })),
    total: count ?? 0,
  };
}

export async function getMessages(conversationId: string, client?: SupabaseLike): Promise<MessageRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase.from("messages")
    .select("id, direction, message_type, payload, transcript, intent_extracted, ts")
    .eq("conversation_id", conversationId).order("ts", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map((m) => ({
    id: m.id as string, direction: m.direction as MessageRow["direction"], messageType: m.message_type as MessageRow["messageType"],
    payload: m.payload ?? null, transcript: (m.transcript as string) ?? null, intentExtracted: m.intent_extracted ?? null, ts: m.ts as string,
  }));
}

export async function getConversationDetail(conversationId: string, client?: SupabaseLike): Promise<ConversationDetail | null> {
  const supabase = client ?? (await createClient());
  const { data: c } = await supabase.from("conversations")
    .select(`${CONVERSATION_COLS}, abandonment_reason`).eq("id", conversationId).maybeSingle();
  if (!c) return null;
  const cr = c as Record<string, unknown>;
  const messages = await getMessages(conversationId, supabase);
  const { data: booking } = await supabase.from("bookings").select("id").eq("conversation_id", conversationId).maybeSingle();
  return {
    id: cr.id as string, customerName: (cr.customer_name as string) ?? null, customerHandle: cr.customer_handle as string,
    channelId: (cr.channel_id as string) ?? null, startedAt: cr.started_at as string, endedAt: (cr.ended_at as string) ?? null,
    outcome: (cr.outcome as ConversationRow["outcome"]) ?? null, language: (cr.language as string) ?? null,
    messageCount: messages.length, abandonmentReason: (cr.abandonment_reason as string) ?? null,
    bookingId: (booking as { id: string } | null)?.id ?? null, messages,
  };
}

export async function getRecentRuns(automationId: string, limit = 10, client?: SupabaseLike): Promise<Array<{ id: string; status: string; startedAt: string; durationMs: number | null; triggerChannel: string | null }>> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase.from("automation_runs")
    .select("id, status, started_at, duration_ms, trigger_channel")
    .eq("automation_id", automationId).order("started_at", { ascending: false }).limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string, status: r.status as string, startedAt: r.started_at as string,
    durationMs: (r.duration_ms as number) ?? null, triggerChannel: (r.trigger_channel as string) ?? null,
  }));
}
