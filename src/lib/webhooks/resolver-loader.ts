import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export type ResolvedAutomation = {
  automationId: string;
  tenantId: string;
  status: string; // building | uat | live | stopped | error
  engineWebhookUrl: string | null;
};

/** Service-role read: the gateway is unauthenticated, RLS would block it. */
export async function loadAutomationFromDb(
  automationId: string,
): Promise<ResolvedAutomation | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("automations")
    .select("id, tenant_id, status, engine_webhook_url")
    .eq("id", automationId)
    .maybeSingle();
  if (!data) return null;
  return {
    automationId: data.id,
    tenantId: data.tenant_id,
    status: data.status,
    engineWebhookUrl: data.engine_webhook_url,
  };
}
