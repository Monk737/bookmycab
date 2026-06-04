import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CustomerRow {
  id: string; tenant_id: string; customer_handle: string; name: string | null;
  first_seen: string | null; last_seen: string | null; total_bookings: number;
  total_spend: number; preferred_vehicle: string | null; vip: boolean; blocked: boolean; tags: string[];
}

export async function listCustomers(tenantId: string): Promise<CustomerRow[]> {
  const { data } = await svc().from("customers").select("*").eq("tenant_id", tenantId).order("last_seen", { ascending: false, nullsFirst: false });
  return (data ?? []) as CustomerRow[];
}

export async function getCustomer(tenantId: string, customerId: string): Promise<CustomerRow | null> {
  const { data } = await svc().from("customers").select("*").eq("tenant_id", tenantId).eq("id", customerId).maybeSingle();
  return (data as CustomerRow) ?? null;
}

export async function getCustomerBookings(tenantId: string, customerHandle: string): Promise<unknown[]> {
  const { data } = await svc().from("bookings").select("id, fare, vehicle_type, pickup_address, destination_address, status, created_at").eq("tenant_id", tenantId).eq("customer_handle", customerHandle).order("created_at", { ascending: false });
  return data ?? [];
}

export async function listNotes(tenantId: string, customerId: string): Promise<{ id: string; body: string; created_at: string }[]> {
  const { data } = await svc().from("customer_notes").select("id, body, created_at").eq("tenant_id", tenantId).eq("customer_id", customerId).order("created_at", { ascending: false });
  return (data ?? []) as { id: string; body: string; created_at: string }[];
}

export async function addNote(tenantId: string, customerId: string, authorId: string, body: string): Promise<void> {
  await svc().from("customer_notes").insert({ tenant_id: tenantId, customer_id: customerId, author_id: authorId, body });
}

export async function setCustomerFlags(tenantId: string, customerId: string, flags: { vip?: boolean; blocked?: boolean }): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof flags.vip === "boolean") patch.vip = flags.vip;
  if (typeof flags.blocked === "boolean") patch.blocked = flags.blocked;
  await svc().from("customers").update(patch).eq("tenant_id", tenantId).eq("id", customerId);
}

/** DSAR export: everything stored for a phone handle. */
export async function dsarExport(tenantId: string, handle: string): Promise<{ customer: unknown; bookings: unknown[]; conversations: unknown[] }> {
  const sb = svc();
  const [customer, bookings, conversations] = await Promise.all([
    sb.from("customers").select("*").eq("tenant_id", tenantId).eq("customer_handle", handle).maybeSingle().then((r) => r.data),
    sb.from("bookings").select("*").eq("tenant_id", tenantId).eq("customer_handle", handle).then((r) => r.data ?? []),
    sb.from("conversations").select("*").eq("tenant_id", tenantId).eq("customer_handle", handle).then((r) => r.data ?? []),
  ]);
  return { customer, bookings, conversations };
}

/** DSAR delete: erase all PII for a phone handle (bookings, conversations,
 *  their messages) + remove the customer row. Returns an error status; not a
 *  single transaction, so it scrubs in PII-first order and reports failures. */
export async function dsarDelete(tenantId: string, handle: string): Promise<{ ok: boolean; error?: string }> {
  const sb = svc();
  const errors: string[] = [];

  // Capture conversation ids BEFORE tombstoning the handle (we find them by handle).
  const { data: convs, error: convErr } = await sb
    .from("conversations").select("id").eq("tenant_id", tenantId).eq("customer_handle", handle);
  if (convErr) errors.push(`conversations lookup: ${convErr.message}`);
  const convIds = (convs ?? []).map((c: { id: string }) => c.id);

  // Scrub message PII for those conversations (payload is NOT NULL → set to {}).
  if (convIds.length > 0) {
    const { error } = await sb.from("messages").update({ payload: {}, transcript: null }).in("conversation_id", convIds);
    if (error) errors.push(`messages: ${error.message}`);
  }

  // Scrub + tombstone bookings (clear all PII-bearing columns).
  {
    const { error } = await sb.from("bookings")
      .update({ passenger_name: null, raw_dispatch_json: null, airport_json: null, driver_note: null, customer_handle: "[erased]" })
      .eq("tenant_id", tenantId).eq("customer_handle", handle);
    if (error) errors.push(`bookings: ${error.message}`);
  }

  // Scrub + tombstone conversations.
  {
    const { error } = await sb.from("conversations")
      .update({ customer_name: null, customer_handle: "[erased]" })
      .eq("tenant_id", tenantId).eq("customer_handle", handle);
    if (error) errors.push(`conversations: ${error.message}`);
  }

  // Remove the derived customer row.
  {
    const { error } = await sb.from("customers").delete().eq("tenant_id", tenantId).eq("customer_handle", handle);
    if (error) errors.push(`customers: ${error.message}`);
  }

  return errors.length ? { ok: false, error: errors.join("; ") } : { ok: true };
}
