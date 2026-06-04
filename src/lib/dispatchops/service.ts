import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { reduceAdapterHealth, type AdapterHealth, type AttemptLite } from "./health";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface FailedDispatch {
  booking_id: string | null; adapter: string; operation: string; error: string | null;
  attempt_no: number; created_at: string; passenger_name: string | null;
}

/** Append a dispatch attempt row. Best-effort; never throws into the caller. */
export async function recordAttempt(args: {
  tenantId: string; automationId?: string | null; bookingId?: string | null;
  adapter: string; operation?: string; status: "success" | "failed" | "retrying";
  latencyMs?: number; attemptNo?: number; request?: unknown; response?: unknown; error?: string | null;
}): Promise<void> {
  try {
    await svc().from("dispatch_attempts").insert({
      tenant_id: args.tenantId, automation_id: args.automationId ?? null, booking_id: args.bookingId ?? null,
      adapter: args.adapter, operation: args.operation ?? "create", status: args.status,
      latency_ms: args.latencyMs ?? null, attempt_no: args.attemptNo ?? 1,
      request: args.request ?? null, response: args.response ?? null, error: args.error ?? null,
    });
  } catch (e) {
    console.error("recordAttempt failed", e);
  }
}

/** Per-adapter health over the trailing `windowHours` for a tenant. */
export async function getHealth(tenantId: string, windowHours = 24): Promise<AdapterHealth[]> {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data } = await svc()
    .from("dispatch_attempts")
    .select("adapter, status, latency_ms")
    .eq("tenant_id", tenantId)
    .gte("created_at", since);
  return reduceAdapterHealth((data ?? []) as AttemptLite[]);
}

/**
 * The failed-dispatch queue: the most recent failed attempt per booking that
 * has no later success. v1 approximation: list recent failed attempts joined to
 * the booking's passenger name.
 */
export async function listFailedDispatches(tenantId: string, limit = 50): Promise<FailedDispatch[]> {
  const sb = svc();
  const { data: fails } = await sb
    .from("dispatch_attempts")
    .select("booking_id, adapter, operation, error, attempt_no, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (fails ?? []) as Omit<FailedDispatch, "passenger_name">[];
  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter((x): x is string => !!x))];
  const names = new Map<string, string | null>();
  if (bookingIds.length > 0) {
    const { data: bookings } = await sb.from("bookings").select("id, passenger_name").in("id", bookingIds);
    for (const b of bookings ?? []) names.set(b.id as string, (b.passenger_name as string) ?? null);
  }
  return rows.map((r) => ({ ...r, passenger_name: r.booking_id ? names.get(r.booking_id) ?? null : null }));
}

/**
 * Retry dispatch for a booking by re-invoking the adapter's createBooking via
 * the dispatch factory, recording a fresh attempt. Graceful: any failure is
 * caught and recorded as a failed attempt. Returns the outcome.
 *
 * NOTE (v1): the retry reconstructs a minimal booking request from the stored
 * address JSON. Full payload fidelity (driver notes, references, flight) is a
 * follow-up; the goal here is to re-trigger the dispatch and record the result.
 *
 * Adapter call changes from plan:
 * - Plan used `getAdapter(adapterString)` (sync, by adapter name). Real factory
 *   exports `getDispatchAdapter(tenantId)` (async, resolves tenant config + credentials).
 * - Plan used `import("@/lib/dispatch/factory")`. Real import is same path but
 *   exports `getDispatchAdapter` and `loadDispatchConfig` (not `getAdapter`).
 * - `companyId` is required in `BookingParams`; obtained from `loadDispatchConfig`.
 * - `pickupTime` (ISO 8601) replaces plan's `pickupAtUtc` field name in BookingParams.
 * - Result field is `dispatchRef` (not `reference`) per `BookingResult` interface.
 */
export async function retryDispatch(tenantId: string, bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = svc();
  const { data: booking } = await sb.from("bookings").select("*").eq("tenant_id", tenantId).eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };

  // Count prior attempts to set attempt_no.
  const { count } = await sb.from("dispatch_attempts").select("id", { count: "exact", head: true }).eq("booking_id", bookingId);
  const attemptNo = (count ?? 0) + 1;
  const adapterName = (booking.dispatch_adapter as string) ?? "autocab";

  const start = Date.now();
  try {
    // Lazy import to avoid loading the dispatch layer in non-retry paths.
    // Real factory: getDispatchAdapter(tenantId) resolves tenant config + credentials.
    // loadDispatchConfig gives us companyId required by BookingParams.
    const { getDispatchAdapter, loadDispatchConfig } = await import("@/lib/dispatch/factory");
    const [client, config] = await Promise.all([
      getDispatchAdapter(tenantId),
      loadDispatchConfig(tenantId),
    ]);
    const res = await client.createBooking({
      companyId: config.companyId,
      pickup: booking.pickup_address as never,
      destination: booking.destination_address as never,
      passengerName: (booking.passenger_name as string) ?? "",
      passengerPhone: (booking.customer_handle as string) ?? "",
      vehicleType: (booking.vehicle_type as string) ?? "saloon",
      // BookingParams uses `pickupTime` (ISO 8601), not `pickupAtUtc`
      pickupTime: (booking.pickup_at_utc as string) ?? new Date().toISOString(),
    });
    const latencyMs = Date.now() - start;
    await recordAttempt({ tenantId, automationId: booking.automation_id as string, bookingId, adapter: adapterName, operation: "create", status: "success", latencyMs, attemptNo, response: res as unknown });
    // BookingResult uses `dispatchRef` (not `reference`)
    const ref = res.dispatchRef;
    if (ref) await sb.from("bookings").update({ dispatch_ref: ref, status: "dispatched" }).eq("id", bookingId);
    return { ok: true };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    await recordAttempt({ tenantId, automationId: booking.automation_id as string, bookingId, adapter: adapterName, operation: "create", status: "failed", latencyMs, attemptNo, error });
    return { ok: false, error };
  }
}
