import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { FeatureKey } from "./catalog";
import {
  mergeEntitlements,
  type Effective,
  type PlanFeatureRow,
  type OverrideRow,
  type RolloutRow,
} from "./merge";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// Short-TTL in-process cache. Entitlements change rarely (admin action); a few
// seconds of staleness is acceptable and spares a 3-query round-trip per request.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; map: Map<FeatureKey, Effective> }>();

/** Clears the resolver cache (call after an admin entitlement write). */
export function invalidateEntitlements(tenantId?: string): void {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

/** Resolves the effective entitlement map for a tenant (cached). */
export async function resolveEntitlements(tenantId: string): Promise<Map<FeatureKey, Effective>> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.map;

  const sb = svc();
  const { data: tenant } = await sb.from("tenants").select("plan_id").eq("id", tenantId).maybeSingle();
  const planId = (tenant?.plan_id as string | null) ?? null;

  const [planFeatures, overrides, rollouts] = await Promise.all([
    planId
      ? sb.from("plan_features").select("feature_key, enabled, quota_limit, quota_period").eq("plan_id", planId)
      : Promise.resolve({ data: [] as PlanFeatureRow[] }),
    sb.from("tenant_entitlements")
      .select("feature_key, enabled, quota_limit, quota_period, expires_at")
      .eq("tenant_id", tenantId),
    sb.from("feature_rollouts").select("feature_key, strategy, percentage, allowlist, kill_switch"),
  ]);

  const map = mergeEntitlements({
    planFeatures: (planFeatures.data ?? []) as PlanFeatureRow[],
    overrides: (overrides.data ?? []) as OverrideRow[],
    rollouts: (rollouts.data ?? []) as RolloutRow[],
    tenantId,
    now: new Date(),
  });

  cache.set(tenantId, { at: Date.now(), map });
  return map;
}

/** True when the tenant currently has the feature enabled. */
export async function hasFeature(tenantId: string | null, key: FeatureKey): Promise<boolean> {
  if (!tenantId) return false;
  const map = await resolveEntitlements(tenantId);
  return map.get(key)?.enabled === true;
}

/** Returns the effective quota for a feature, or null when unlimited/absent. */
export async function getQuota(
  tenantId: string,
  key: FeatureKey,
): Promise<{ limit: number | null; period: "day" | "month" | null }> {
  const map = await resolveEntitlements(tenantId);
  const e = map.get(key);
  return { limit: e?.quotaLimit ?? null, period: e?.quotaPeriod ?? null };
}
