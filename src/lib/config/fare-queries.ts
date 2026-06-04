import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface FareRuleRow {
  id: string; vehicle_type: string; base_fare: number; per_mile: number; per_min: number;
  min_fare: number; airport_surcharge: number; currency: string;
}

export async function listFareRules(tenantId: string, automationId: string): Promise<FareRuleRow[]> {
  const { data } = await svc().from("fare_rules").select("id, vehicle_type, base_fare, per_mile, per_min, min_fare, airport_surcharge, currency").eq("tenant_id", tenantId).eq("automation_id", automationId).order("vehicle_type");
  return (data ?? []) as FareRuleRow[];
}

export async function upsertFareRule(tenantId: string, automationId: string, rule: Omit<FareRuleRow, "id">): Promise<void> {
  await svc().from("fare_rules").upsert(
    {
      tenant_id: tenantId, automation_id: automationId, vehicle_type: rule.vehicle_type,
      base_fare: rule.base_fare, per_mile: rule.per_mile, per_min: rule.per_min,
      min_fare: rule.min_fare, airport_surcharge: rule.airport_surcharge, currency: rule.currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "automation_id,vehicle_type" },
  );
}

export async function deleteFareRule(tenantId: string, ruleId: string): Promise<void> {
  await svc().from("fare_rules").delete().eq("tenant_id", tenantId).eq("id", ruleId);
}
