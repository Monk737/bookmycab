import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export type ResolvedAutomation = {
  automationId: string;
  tenantId: string;
  status: string; // building | uat | live | stopped | error
  engineWebhookUrl: string | null;
  /** Tenant's chat subscription status (active | paused | cancelled), or null
   *  when the tenant has no chat_subscriptions row. Drives the chat billing gate
   *  in the webhook gateway. Cached with the rest of the record (≤ TTL staleness;
   *  the billing webhook invalidates this on a status change for prompt resume). */
  chatSubStatus: string | null;
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

  // The tenant's chat subscription status (one row per tenant). Fetched only on
  // a resolver cache miss, so it stays off the per-message hot path.
  const { data: chatSub } = await supabase
    .from("chat_subscriptions")
    .select("status")
    .eq("tenant_id", data.tenant_id)
    .maybeSingle();

  return {
    automationId: data.id,
    tenantId: data.tenant_id,
    status: data.status,
    engineWebhookUrl: data.engine_webhook_url,
    chatSubStatus: (chatSub?.status as string | null) ?? null,
  };
}

/** Reads the inbound-verify secret for a channel from the Epic-3 vault. */
export async function loadChannelVerifySecret(
  automationId: string,
  credentialType: string,
): Promise<string | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  // Find the channel_credentials row id for this automation's channel + type,
  // then decrypt via the key-param RPC wrapper (Epic 3 migration 0010).
  const { data: cred } = await supabase
    .from("channel_credentials")
    .select("id, channels!inner(automation_id)")
    .eq("credential_type", credentialType)
    .eq("channels.automation_id", automationId)
    .maybeSingle();
  if (!cred) return null;
  const { data: secret, error } = await supabase.rpc("vault_read_credential_rpc", {
    p_id: (cred as { id: string }).id,
    p_accessed_by: null,
    p_key: env.SUPABASE_VAULT_KEY,
  });
  if (error) return null;
  return (secret as string) ?? null;
}
