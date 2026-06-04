import type { FeatureKey } from "./catalog";

export type QuotaPeriod = "day" | "month" | null;

export interface PlanFeatureRow {
  feature_key: string;
  enabled: boolean;
  quota_limit: number | null;
  quota_period: QuotaPeriod;
}

export interface OverrideRow {
  feature_key: string;
  enabled: boolean;
  quota_limit: number | null;
  quota_period: QuotaPeriod;
  expires_at: string | null;
}

export interface RolloutRow {
  feature_key: string;
  strategy: "all" | "percentage" | "allowlist" | "off";
  percentage: number;
  allowlist: readonly string[];
  kill_switch: boolean;
}

export interface Effective {
  enabled: boolean;
  quotaLimit: number | null;
  quotaPeriod: QuotaPeriod;
}

/** Deterministic 0–99 bucket for percentage rollouts (FNV-1a over tenantId+key). */
function bucket(tenantId: string, featureKey: string): number {
  let h = 0x811c9dc5;
  const s = `${tenantId}:${featureKey}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

/** Returns true when the rollout permits the feature for this tenant. */
function rolloutAllows(r: RolloutRow | undefined, tenantId: string, featureKey: string): boolean {
  if (!r) return true; // no rollout row = fully on
  if (r.kill_switch || r.strategy === "off") return false;
  if (r.strategy === "all") return true;
  if (r.strategy === "allowlist") return r.allowlist.includes(tenantId);
  if (r.strategy === "percentage") return bucket(tenantId, featureKey) < r.percentage;
  return true;
}

/**
 * Merge plan defaults, tenant overrides, and rollouts into the effective
 * entitlement map. Precedence: rollout(off/kill) > override > plan default.
 */
export function mergeEntitlements(args: {
  planFeatures: readonly PlanFeatureRow[];
  overrides: readonly OverrideRow[];
  rollouts: readonly RolloutRow[];
  tenantId: string;
  now: Date;
}): Map<FeatureKey, Effective> {
  const { planFeatures, overrides, rollouts, tenantId, now } = args;
  const out = new Map<FeatureKey, Effective>();
  const rolloutByKey = new Map(rollouts.map((r) => [r.feature_key, r]));
  const overrideByKey = new Map(
    overrides
      .filter((o) => !o.expires_at || new Date(o.expires_at) > now)
      .map((o) => [o.feature_key, o]),
  );

  for (const pf of planFeatures) {
    const ov = overrideByKey.get(pf.feature_key);
    const base = ov ?? pf;
    const allowed = rolloutAllows(rolloutByKey.get(pf.feature_key), tenantId, pf.feature_key);
    out.set(pf.feature_key as FeatureKey, {
      enabled: allowed && base.enabled,
      quotaLimit: base.quota_limit,
      quotaPeriod: base.quota_period,
    });
  }

  // Overrides may enable a feature the plan doesn't list at all.
  for (const ov of overrideByKey.values()) {
    if (out.has(ov.feature_key as FeatureKey)) continue;
    const allowed = rolloutAllows(rolloutByKey.get(ov.feature_key), tenantId, ov.feature_key);
    out.set(ov.feature_key as FeatureKey, {
      enabled: allowed && ov.enabled,
      quotaLimit: ov.quota_limit,
      quotaPeriod: ov.quota_period,
    });
  }

  return out;
}
