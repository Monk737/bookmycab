import "server-only";
import { createClient } from "@/lib/supabase/server";

export type VoiceBookingStatus =
  | "confirmed"
  | "cancelled"
  | "modified"
  | "completed"
  | "no_show";

export interface VoiceBookingRow {
  id: string;
  automation_id: string;
  booking_ref: string;
  status: VoiceBookingStatus;
  pickup: string | null;
  destination: string | null;
  pickup_time: string | null;
  passenger_name: string | null;
  passengers: number | null;
  bags: number | null;
  vehicle_type: string | null;
  fare: string | null;
  created_at: string;
  cancelled_at: string | null;
}

/**
 * Recent voice bookings for a tenant, newest first. Read through the server
 * (RLS-scoped) client — the voice_bookings_select policy restricts rows to the
 * caller's tenant, matching how calls are read.
 */
export async function getVoiceBookings(
  tenantId: string,
  limit = 20,
): Promise<VoiceBookingRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_bookings")
    .select(
      "id, automation_id, booking_ref, status, pickup, destination, pickup_time, passenger_name, passengers, bags, vehicle_type, fare, created_at, cancelled_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as VoiceBookingRow[];
}
