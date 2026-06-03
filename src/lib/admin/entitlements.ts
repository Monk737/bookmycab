import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { invalidateEntitlements } from "@/lib/entitlements/resolve";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface PlanRow { id: string; code: string; name: string; base_price: number | null }
export interface FeatureRow { key: string; name: string; category: string; metered: boolean; unit: string | null }

export async function listPlans(): Promise<PlanRow[]> {
  const { data } = await svc().from("plans").select("id, code, name, base_price").order("base_price");
  return (data ?? []) as PlanRow[];
}

export async function listFeatures(): Promise<FeatureRow[]> {
  const { data } = await svc().from("features").select("key, name, category, metered, unit").order("category");
  return (data ?? []) as FeatureRow[];
}

export async function listPlanFeatures(planId: string): Promise<{ feature_key: string; enabled: boolean }[]> {
  const { data } = await svc().from("plan_features").select("feature_key, enabled").eq("plan_id", planId);
  return (data ?? []) as { feature_key: string; enabled: boolean }[];
}

export async function setPlanFeature(planId: string, featureKey: string, enabled: boolean): Promise<void> {
  await svc().from("plan_features").upsert(
    { plan_id: planId, feature_key: featureKey, enabled },
    { onConflict: "plan_id,feature_key" },
  );
  invalidateEntitlements(); // plan change affects all tenants on it
}

export async function listTenantEntitlements(tenantId: string): Promise<{ feature_key: string; enabled: boolean }[]> {
  const { data } = await svc().from("tenant_entitlements").select("feature_key, enabled").eq("tenant_id", tenantId);
  return (data ?? []) as { feature_key: string; enabled: boolean }[];
}

export async function setTenantEntitlement(args: {
  tenantId: string;
  featureKey: string;
  enabled: boolean;
  setBy: string;
  note?: string;
}): Promise<void> {
  const { tenantId, featureKey, enabled, setBy, note } = args;
  await svc().from("tenant_entitlements").upsert(
    { tenant_id: tenantId, feature_key: featureKey, enabled, set_by: setBy, note: note ?? null, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,feature_key" },
  );
  invalidateEntitlements(tenantId);
}
