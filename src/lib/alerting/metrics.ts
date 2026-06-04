import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AlertMetricDef {
  key: string;
  label: string;
  unit: string;
  /** Compute the current metric value over the trailing window for a tenant. */
  getValue: (tenantId: string, windowHours: number) => Promise<number>;
}

/** ISO timestamp `windowHours` ago. */
function since(windowHours: number): string {
  return new Date(Date.now() - windowHours * 3600_000).toISOString();
}

/** Abandonment rate (%) over the window. */
async function abandonmentRate(tenantId: string, windowHours: number): Promise<number> {
  const sb = svc();
  const { data } = await sb
    .from("conversations")
    .select("outcome")
    .eq("tenant_id", tenantId)
    .gte("started_at", since(windowHours));
  const rows = data ?? [];
  if (rows.length === 0) return 0;
  const abandoned = rows.filter((r: { outcome: string | null }) => r.outcome === "abandoned").length;
  return +((abandoned / rows.length) * 100).toFixed(1);
}

/** Number of confirmed bookings over the window. */
async function bookingsCount(tenantId: string, windowHours: number): Promise<number> {
  const sb = svc();
  const { count } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", since(windowHours));
  return count ?? 0;
}

export const ALERT_METRICS: Record<string, AlertMetricDef> = {
  abandonment_rate: { key: "abandonment_rate", label: "Abandonment rate", unit: "%", getValue: abandonmentRate },
  bookings_count: { key: "bookings_count", label: "Bookings", unit: "", getValue: bookingsCount },
};
