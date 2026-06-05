import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { FEATURE_KEYS, FEATURE_CATALOG } from "@/lib/entitlements/catalog";
import { invalidateEntitlements } from "@/lib/entitlements/resolve";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export type RolloutStrategy = "all" | "percentage" | "allowlist" | "off";

export interface RolloutInput {
  strategy: RolloutStrategy;
  percentage: number;
  killSwitch: boolean;
}

const STRATEGIES: RolloutStrategy[] = ["all", "percentage", "allowlist", "off"];

/** Pure: validate a rollout input. Returns { ok } or { ok:false, error }. */
export function validateRollout(input: RolloutInput): { ok: boolean; error?: string } {
  if (!STRATEGIES.includes(input.strategy)) return { ok: false, error: "Unknown strategy." };
  if (!Number.isFinite(input.percentage) || input.percentage < 0 || input.percentage > 100) {
    return { ok: false, error: "Percentage must be between 0 and 100." };
  }
  return { ok: true };
}

export interface RolloutRow {
  featureKey: string;
  name: string;
  category: string;
  strategy: RolloutStrategy;
  percentage: number;
  killSwitch: boolean;
}

/** Every catalog feature with its current rollout (defaults to fully-on when no row). */
export async function listRollouts(): Promise<RolloutRow[]> {
  const { data } = await svc().from("feature_rollouts").select("feature_key, strategy, percentage, kill_switch");
  const byKey = new Map((data ?? []).map((r) => [r.feature_key as string, r]));
  return FEATURE_KEYS.map((key) => {
    const r = byKey.get(key);
    const f = FEATURE_CATALOG[key];
    return {
      featureKey: key,
      name: f.name,
      category: f.category,
      strategy: ((r?.strategy as RolloutStrategy) ?? "all"),
      percentage: (r?.percentage as number) ?? 100,
      killSwitch: (r?.kill_switch as boolean) ?? false,
    };
  });
}

/** Upsert a feature's rollout and invalidate the resolver cache (affects all tenants). */
export async function setRollout(featureKey: string, input: RolloutInput): Promise<{ ok: boolean; error?: string }> {
  const v = validateRollout(input);
  if (!v.ok) return v;
  if (!FEATURE_KEYS.includes(featureKey as never)) return { ok: false, error: "Unknown feature." };
  await svc().from("feature_rollouts").upsert(
    { feature_key: featureKey, strategy: input.strategy, percentage: input.percentage, kill_switch: input.killSwitch, updated_at: new Date().toISOString() },
    { onConflict: "feature_key" },
  );
  invalidateEntitlements(); // a rollout change affects every tenant's resolution
  return { ok: true };
}
