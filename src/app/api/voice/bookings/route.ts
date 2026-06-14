import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseVoiceBookingBody } from "@/lib/voice/bookings-schema";

export const runtime = "nodejs";

/**
 * Voice booking mirror endpoint. The AI Voice engine calls this after each
 * Autocab create / modify / cancel, authenticated with the same VOICE_INGEST_SECRET
 * as the call-ingest endpoint. Writes go through the record_voice_booking upsert
 * RPC (service role), keyed on (tenant_id, booking_ref).
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const parsed = parseVoiceBookingBody(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const d = parsed.data;

  const db = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await db.rpc("record_voice_booking", {
    p_tenant: d.tenant_id,
    p_automation: d.automation_id,
    p_booking_ref: d.booking_ref,
    p_status: d.status,
    p_provider_call_id: d.provider_call_id ?? null,
    p_pickup: d.pickup ?? null,
    p_destination: d.destination ?? null,
    p_pickup_time: d.pickup_time ?? null,
    p_passenger_name: d.passenger_name ?? null,
    p_passengers: d.passengers ?? null,
    p_bags: d.bags ?? null,
    p_vehicle_type: d.vehicle_type ?? null,
    p_fare: d.fare ?? null,
    p_caller_number: d.caller_number ?? null,
    p_raw: (d.raw ?? null) as never,
  });
  if (error) {
    console.error("record_voice_booking failed", error);
    return NextResponse.json(
      { error: "Could not record the booking." },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 200 });
}
