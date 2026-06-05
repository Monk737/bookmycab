import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { reduceUsage, reducePlatformHealth, type TenantUsage, type PlatformHealth } from "./reduce";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Per-tenant usage across features for the current period (admin-wide). */
export async function getUsageOverview(): Promise<TenantUsage[]> {
  const sb = svc();
  const [{ data: counters }, { data: tenants }] = await Promise.all([
    sb.from("usage_counters").select("tenant_id, feature_key, used, limit_amount"),
    sb.from("tenants").select("id, name"),
  ]);
  const byId = new Map<string, string>();
  for (const t of tenants ?? []) byId.set(t.id as string, (t.name as string) ?? "");
  return reduceUsage((counters ?? []) as never, byId);
}

/** Platform-wide health over the trailing window (admin-wide). */
export async function getPlatformHealth(windowHours = 168): Promise<PlatformHealth> {
  const sb = svc();
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const [{ data: runs }, { data: dispatch }, { data: notifications }] = await Promise.all([
    sb.from("automation_runs").select("status").gte("started_at", since),
    sb.from("dispatch_attempts").select("adapter, status").gte("created_at", since),
    sb.from("notification_log").select("status").gte("sent_at", since),
  ]);
  return reducePlatformHealth({
    runs: (runs ?? []) as never,
    dispatch: (dispatch ?? []) as never,
    notifications: (notifications ?? []) as never,
  });
}
