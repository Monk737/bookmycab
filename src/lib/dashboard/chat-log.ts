import "server-only";
import { createClient } from "@/lib/supabase/server";

/* ----------------------------------------------------------------------------
   Full-window Chat logs for the dashboard's searchable / date-filtered panels.

   Unlike the capped `recent` lists in getChatAnalytics, these return the whole
   window (newest first) so the LogShell can search + filter by day. Two distinct
   shapes — conversations (interaction-centric) and bookings (dispatch-centric).
   -------------------------------------------------------------------------- */

export interface ChatConversationLogRow {
  id: string;
  who: string;
  handle: string | null;
  name: string | null;
  channel: string;
  outcome: string;
  viaVoice: boolean;
  /** True when a WhatsApp voice note was captured for this journey (playable). */
  hasVoiceNote: boolean;
  summary: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Dispatch ref of the booking made in this conversation, if any. */
  bookingRef: string | null;
}

export interface ChatBookingLogRow {
  id: string;
  ref: string | null;
  status: string;
  passengerName: string | null;
  contact: string | null;
  pickup: string | null;
  destination: string | null;
  vehicleType: string | null;
  passengers: number | null;
  fare: string | null;
  distance: number | null;
  distanceUnit: string | null;
  pickupAt: string | null;
  pickupTimeMode: string | null;
  driverNote: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string | null;
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

/** Full conversation log for a tenant over the last `days`, newest first. */
export async function getChatConversations(
  tenantId: string,
  days = 90,
): Promise<ChatConversationLogRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: convos } = await supabase
    .from("conversations")
    .select(
      "id, customer_handle, customer_name, outcome, via_voice, voice_note_path, summary, started_at, ended_at, channel_id",
    )
    .eq("tenant_id", tenantId)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1500);

  const rows = (convos ?? []) as Record<string, unknown>[];

  // Resolve channel type + the booking ref placed in each conversation in one
  // round-trip each, then stitch.
  const [channelsRes, bookingsRes] = await Promise.all([
    supabase.from("channels").select("id, type").eq("tenant_id", tenantId),
    supabase
      .from("bookings")
      .select("conversation_id, dispatch_ref")
      .eq("tenant_id", tenantId)
      .not("conversation_id", "is", null),
  ]);

  const channelType = new Map<string, string>();
  for (const c of (channelsRes.data ?? []) as { id: string; type: string }[]) channelType.set(c.id, c.type);
  const refByConv = new Map<string, string>();
  for (const b of (bookingsRes.data ?? []) as { conversation_id: string; dispatch_ref: string }[]) {
    if (b.conversation_id && b.dispatch_ref && !refByConv.has(b.conversation_id)) {
      refByConv.set(b.conversation_id, b.dispatch_ref);
    }
  }

  return rows.map((r) => {
    const id = r.id as string;
    const handle = (r.customer_handle as string) ?? null;
    const name = (r.customer_name as string)?.trim() || null;
    return {
      id,
      who: name || handle || "Unknown",
      handle,
      name,
      channel: (r.channel_id ? channelType.get(r.channel_id as string) : undefined) ?? "whatsapp",
      outcome: (r.outcome as string) ?? "unknown",
      viaVoice: Boolean(r.via_voice),
      hasVoiceNote: Boolean(r.voice_note_path),
      summary: (r.summary as string) ?? null,
      startedAt: r.started_at as string,
      endedAt: (r.ended_at as string) ?? null,
      bookingRef: refByConv.get(id) ?? null,
    };
  });
}

/** Full booking log for a tenant over the last `days`, newest first. */
export async function getChatBookings(
  tenantId: string,
  days = 90,
): Promise<ChatBookingLogRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, dispatch_ref, status, passenger_name, customer_handle, pickup_address, destination_address, vehicle_type, passenger_count, fare, currency, distance, distance_unit, pickup_at_utc, pickup_time_mode, driver_note, summary, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    // The Chat bookings feed shows only the rides the bot acted on: booked
    // (confirmed), modified, cancelled — never dispatch lifecycle states.
    .in("status", ["confirmed", "modified", "cancelled"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1500);

  return ((data ?? []) as Record<string, unknown>[]).map((b) => ({
    id: b.id as string,
    ref: (b.dispatch_ref as string) ?? null,
    status: (b.status as string) ?? "confirmed",
    passengerName: (b.passenger_name as string)?.trim() || null,
    contact: (b.customer_handle as string) ?? null,
    pickup: addressLine(b.pickup_address),
    destination: addressLine(b.destination_address),
    vehicleType: (b.vehicle_type as string) ?? null,
    passengers: (b.passenger_count as number) ?? null,
    fare: formatFare(b.fare, b.currency),
    distance: b.distance != null && Number.isFinite(Number(b.distance)) ? Number(b.distance) : null,
    distanceUnit: (b.distance_unit as string)?.trim() || null,
    pickupAt: (b.pickup_at_utc as string) ?? null,
    pickupTimeMode: (b.pickup_time_mode as string) ?? null,
    driverNote: (b.driver_note as string) ?? null,
    summary: (b.summary as string) ?? null,
    createdAt: b.created_at as string,
    updatedAt: (b.updated_at as string) ?? null,
  }));
}
