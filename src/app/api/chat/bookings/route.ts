import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseChatBookingBody } from "@/lib/chat/ingest-schema";

export const runtime = "nodejs";

/** Normalise an address field to jsonb: a plain text line becomes { text }. */
function toAddressJson(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() ? { text: v } : null;
  if (typeof v === "object") return v as Record<string, unknown>;
  return null;
}

/**
 * Chat booking mirror endpoint. The WhatsApp Chatbot n8n workflow calls this
 * after each Autocab create / modify / cancel, authenticated with
 * CHAT_INGEST_SECRET. Writes go through the record_chat_booking upsert RPC
 * (service role), keyed on (tenant_id, dispatch_ref) — the same booking row the
 * Chat dashboard's bookings feed reads.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.CHAT_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const parsed = parseChatBookingBody(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const d = parsed.data;

  const db = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await db.rpc("record_chat_booking", {
    p_tenant: d.tenant_id,
    p_automation: d.automation_id,
    p_dispatch_ref: d.dispatch_ref,
    p_status: d.status,
    p_conversation_ref: d.conversation_ref ?? null,
    p_channel_type: d.channel_type ?? "whatsapp",
    p_dispatch_adapter: d.dispatch_adapter ?? null,
    p_passenger_name: d.passenger_name ?? null,
    p_customer_handle: d.customer_handle ?? null,
    p_pickup: toAddressJson(d.pickup) as never,
    p_destination: toAddressJson(d.destination) as never,
    p_vehicle_type: d.vehicle_type ?? null,
    p_passenger_count: d.passenger_count ?? null,
    p_fare: d.fare ?? null,
    p_currency: d.currency ?? "GBP",
    p_pickup_at: d.pickup_at ?? null,
    p_pickup_time_mode: d.pickup_time_mode ?? null,
    p_driver_note: d.driver_note ?? null,
    p_raw: (d.raw ?? null) as never,
  });
  if (error) {
    console.error("record_chat_booking failed", error);
    return NextResponse.json(
      { error: "Could not record the booking." },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 200 });
}
