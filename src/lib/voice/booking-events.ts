import "server-only";
import { createClient } from "@/lib/supabase/server";

export type VoiceBookingAction =
  | "confirmed"
  | "modified"
  | "cancelled"
  | "completed"
  | "no_show";

export interface VoiceBookingEventRow {
  id: string;
  booking_ref: string;
  action: VoiceBookingAction;
  pickup: string | null;
  destination: string | null;
  pickup_time: string | null;
  passenger_name: string | null;
  passengers: number | null;
  bags: number | null;
  vehicle_type: string | null;
  fare: string | null;
  caller_number: string | null;
  occurred_at: string;
  /** The originating call (resolved via provider_call_id), if one is on record.
   *  Present means the booking row can open the call's transcript + recording. */
  callId: string | null;
  callStartedAt: string | null;
}

type EventRow = Omit<VoiceBookingEventRow, "callId" | "callStartedAt"> & {
  provider_call_id: string | null;
};

/**
 * Append-only voice booking event log for a tenant over the last `days`, newest
 * first. RLS-scoped through the server client. Each create / modify / cancel is
 * a separate row, so the dashboard can stack the full history.
 *
 * Each event is resolved back to its originating call (via provider_call_id ->
 * calls.provider_call_id) so the dashboard can open the call's transcript and
 * recording straight from a booking, the way Recent calls does.
 */
export async function getVoiceBookingEvents(
  tenantId: string,
  days = 90,
): Promise<VoiceBookingEventRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase
    .from("voice_booking_events")
    .select(
      "id, booking_ref, action, pickup, destination, pickup_time, passenger_name, passengers, bags, vehicle_type, fare, caller_number, provider_call_id, occurred_at",
    )
    .eq("tenant_id", tenantId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(1000);

  const events = (data ?? []) as EventRow[];

  // Resolve provider call ids to our call rows in one query, then attach the
  // call's id + start time to each event so the row can open the transcript.
  const providerIds = [...new Set(events.map((e) => e.provider_call_id).filter((v): v is string => !!v))];
  const callByProvider = new Map<string, { id: string; started_at: string }>();
  if (providerIds.length > 0) {
    const { data: calls } = await supabase
      .from("calls")
      .select("id, provider_call_id, started_at")
      .eq("tenant_id", tenantId)
      .in("provider_call_id", providerIds);
    for (const c of (calls ?? []) as { id: string; provider_call_id: string; started_at: string }[]) {
      callByProvider.set(c.provider_call_id, { id: c.id, started_at: c.started_at });
    }
  }

  return events.map(({ provider_call_id, ...e }) => {
    const call = provider_call_id ? callByProvider.get(provider_call_id) ?? null : null;
    return { ...e, callId: call?.id ?? null, callStartedAt: call?.started_at ?? null };
  });
}
