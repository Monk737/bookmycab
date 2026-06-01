import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Internal engine workflow id for an automation (never surfaced to tenants). */
export async function getEngineWorkflowId(automationId: string): Promise<string | null> {
  const { data } = await svc()
    .from("automations")
    .select("engine_workflow_id")
    .eq("id", automationId)
    .maybeSingle();
  return (data?.engine_workflow_id as string) ?? null;
}

export async function setAutomationStatus(automationId: string, status: string): Promise<void> {
  await svc().from("automations").update({ status, updated_at: new Date().toISOString() }).eq("id", automationId);
}
