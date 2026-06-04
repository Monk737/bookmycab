import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { FeatureKey } from "./catalog";
import { getQuota } from "./resolve";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Pure: is `used` strictly under `limit`? null limit = unlimited. */
export function withinQuota(used: number, limit: number | null): boolean {
  if (limit === null) return true;
  return used < limit;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pure: the [start, end] calendar period (YYYY-MM-DD) containing `at`. */
export function periodBounds(
  period: "day" | "month",
  at: Date,
): { start: string; end: string } {
  if (period === "day") {
    const s = iso(at);
    return { start: s, end: s };
  }
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0));
  return { start: iso(start), end: iso(end) };
}

// NOTE (known v1 limitation): the counter bucket period is taken from the
// feature's CURRENT resolved quota period. If an admin changes a feature's
// quota_period (day↔month) mid-cycle, subsequent reads bucket into a fresh
// period and accumulated usage appears reset. usage_events remains the
// append-only source of truth; a future reconcile/rebuild-counters job (billing
// epic) can recompute usage_counters from it. Do not rely on usage_counters for
// financial settlement without that reconciliation.

/**
 * Record a metered action: append to usage_events and bump usage_counters for
 * the current period. Best-effort; never throws into the caller's hot path.
 */
export async function recordUsage(args: {
  tenantId: string;
  featureKey: FeatureKey;
  quantity?: number;
  automationId?: string;
  unit?: string;
  costMicros?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { tenantId, featureKey, quantity = 1, automationId, unit, costMicros, metadata } = args;
  const sb = svc();
  await sb.from("usage_events").insert({
    tenant_id: tenantId,
    feature_key: featureKey,
    automation_id: automationId ?? null,
    quantity,
    unit: unit ?? null,
    cost_micros: costMicros ?? null,
    metadata: metadata ?? {},
  });

  const { period } = await getQuota(tenantId, featureKey);
  const p = period ?? "month";
  const { start, end } = periodBounds(p, new Date());
  // Upsert + increment via RPC-free read-modify-write (counters are low-contention
  // per tenant/feature/period; a race at worst under-counts by a small amount,
  // which usage_events remains the source of truth to reconcile).
  const { data: existing } = await sb
    .from("usage_counters")
    .select("used")
    .eq("tenant_id", tenantId)
    .eq("feature_key", featureKey)
    .eq("period_start", start)
    .maybeSingle();
  const used = ((existing?.used as number) ?? 0) + quantity;
  await sb.from("usage_counters").upsert(
    { tenant_id: tenantId, feature_key: featureKey, period_start: start, period_end: end, used, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,feature_key,period_start" },
  );
}

/** Current period usage for a feature. */
export async function getUsage(tenantId: string, featureKey: FeatureKey): Promise<number> {
  const { period } = await getQuota(tenantId, featureKey);
  const { start } = periodBounds(period ?? "month", new Date());
  const { data } = await svc()
    .from("usage_counters")
    .select("used")
    .eq("tenant_id", tenantId)
    .eq("feature_key", featureKey)
    .eq("period_start", start)
    .maybeSingle();
  return (data?.used as number) ?? 0;
}

/** Quota check: { allowed, used, limit }. */
export async function checkQuota(
  tenantId: string,
  featureKey: FeatureKey,
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const { limit } = await getQuota(tenantId, featureKey);
  const used = await getUsage(tenantId, featureKey);
  return { allowed: withinQuota(used, limit), used, limit };
}
