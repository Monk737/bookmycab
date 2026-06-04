import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Guardrail } from "./guardrails";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function listGuardrails(automationId: string): Promise<Guardrail[]> {
  const { data } = await svc().from("config_guardrails").select("field, locked, min_value, max_value").eq("automation_id", automationId);
  return (data ?? []) as Guardrail[];
}

export async function setGuardrail(args: { automationId: string; field: string; locked: boolean; minValue: number | null; maxValue: number | null }): Promise<void> {
  await svc().from("config_guardrails").upsert(
    { automation_id: args.automationId, field: args.field, locked: args.locked, min_value: args.minValue, max_value: args.maxValue, updated_at: new Date().toISOString() },
    { onConflict: "automation_id,field" },
  );
}
