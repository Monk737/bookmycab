import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { reduceCustomerStats, type BookingLite, type ConversationLite } from "./aggregate";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Derive customer rows for a tenant from their bookings + conversations,
 * grouped by customer_handle, and upsert them. Idempotent. Preserves existing
 * vip/blocked/tags (only stats + name are recomputed).
 */
export async function syncCustomers(tenantId: string): Promise<{ upserted: number }> {
  const sb = svc();
  const [{ data: bookings }, { data: convos }] = await Promise.all([
    sb.from("bookings").select("customer_handle, fare, vehicle_type, created_at, passenger_name").eq("tenant_id", tenantId),
    sb.from("conversations").select("customer_handle, customer_name, started_at").eq("tenant_id", tenantId),
  ]);

  const byHandle = new Map<string, { bookings: BookingLite[]; conversations: ConversationLite[] }>();
  for (const b of bookings ?? []) {
    const h = (b as { customer_handle: string | null }).customer_handle;
    if (!h || h === "[erased]") continue;
    const e = byHandle.get(h) ?? { bookings: [], conversations: [] };
    e.bookings.push({ fare: b.fare, vehicle_type: b.vehicle_type, created_at: b.created_at, passenger_name: b.passenger_name });
    byHandle.set(h, e);
  }
  for (const c of convos ?? []) {
    const h = (c as { customer_handle: string | null }).customer_handle;
    if (!h || h === "[erased]") continue;
    const e = byHandle.get(h) ?? { bookings: [], conversations: [] };
    e.conversations.push({ customer_name: c.customer_name, started_at: c.started_at });
    byHandle.set(h, e);
  }

  let upserted = 0;
  for (const [handle, e] of byHandle) {
    const s = reduceCustomerStats(e.bookings, e.conversations);
    const { error } = await sb.from("customers").upsert(
      {
        tenant_id: tenantId, customer_handle: handle, name: s.name,
        first_seen: s.firstSeen, last_seen: s.lastSeen, total_bookings: s.totalBookings,
        total_spend: s.totalSpend, preferred_vehicle: s.preferredVehicle, updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_handle" },
    );
    if (!error) upserted++;
  }
  return { upserted };
}
