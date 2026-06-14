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
  occurred_at: string;
}

/**
 * Append-only voice booking event log for a tenant over the last `days`, newest
 * first. RLS-scoped through the server client. Each create / modify / cancel is
 * a separate row, so the dashboard can stack the full history.
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
      "id, booking_ref, action, pickup, destination, pickup_time, passenger_name, passengers, bags, vehicle_type, fare, occurred_at",
    )
    .eq("tenant_id", tenantId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as VoiceBookingEventRow[];
}
