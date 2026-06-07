import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { generateApiKey, hashKey, signWebhook, matchWebhooks } from "./crypto";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ApiKeyRow { id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string }
export interface WebhookRow { id: string; url: string; events: string[]; enabled: boolean; failure_count: number; created_at: string }

/** List a tenant's keys, NEVER returns key_hash. */
export async function listKeys(tenantId: string): Promise<ApiKeyRow[]> {
  const { data } = await svc().from("api_keys").select("id, name, prefix, last_used_at, revoked_at, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as ApiKeyRow[];
}

/** Issue a key, returns the RAW key exactly once (caller must show + discard). */
export async function issueKey(tenantId: string, name: string, createdBy: string): Promise<{ raw: string; prefix: string }> {
  const k = generateApiKey();
  await svc().from("api_keys").insert({ tenant_id: tenantId, name, prefix: k.prefix, key_hash: k.hash, created_by: createdBy });
  return { raw: k.raw, prefix: k.prefix };
}

export async function revokeKey(tenantId: string, keyId: string): Promise<void> {
  await svc().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", keyId);
}

/** Verify a raw API key: returns the tenant_id when valid + not revoked, else null. Meters api_access. */
export async function verifyApiKey(raw: string): Promise<{ tenantId: string } | null> {
  const { data } = await svc().from("api_keys").select("id, tenant_id, revoked_at").eq("key_hash", hashKey(raw)).maybeSingle();
  if (!data || data.revoked_at) return null;
  const tenantId = data.tenant_id as string;
  await svc().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  await recordUsage({ tenantId, featureKey: "api_access", quantity: 1, unit: "calls" });
  return { tenantId };
}

export async function listWebhooks(tenantId: string): Promise<WebhookRow[]> {
  const { data } = await svc().from("outbound_webhooks").select("id, url, events, enabled, failure_count, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as WebhookRow[];
}

export async function createWebhook(tenantId: string, url: string, events: string[]): Promise<void> {
  const secret = generateApiKey().raw.replace("cab_", "whsec_");
  await svc().from("outbound_webhooks").insert({ tenant_id: tenantId, url, events, secret });
}

export async function deleteWebhook(tenantId: string, webhookId: string): Promise<void> {
  await svc().from("outbound_webhooks").delete().eq("tenant_id", tenantId).eq("id", webhookId);
}

/**
 * Dispatch an event to all matching enabled webhooks: sign the payload, POST it,
 * record a delivery row. Best-effort; never throws into the caller.
 */
export async function dispatchWebhook(tenantId: string, event: string, payload: Record<string, unknown>): Promise<{ delivered: number }> {
  const sb = svc();
  const { data } = await sb.from("outbound_webhooks").select("id, url, events, enabled, secret").eq("tenant_id", tenantId);
  const hooks = (data ?? []) as (WebhookRow & { secret: string })[];
  const targets = matchWebhooks(hooks, event);
  const body = JSON.stringify({ event, data: payload, ts: new Date().toISOString() });
  let delivered = 0;

  for (const h of targets) {
    let status: "delivered" | "failed" = "failed";
    let code: number | null = null;
    try {
      const res = await fetch(h.url, { method: "POST", headers: { "content-type": "application/json", "x-bookmycab-signature": signWebhook(body, h.secret), "x-bookmycab-event": event }, body });
      code = res.status;
      status = res.ok ? "delivered" : "failed";
    } catch { status = "failed"; }
    try {
      await sb.from("webhook_deliveries").insert({ webhook_id: h.id, tenant_id: tenantId, event, status, response_code: code });
      if (status === "delivered") delivered++;
      else await sb.from("outbound_webhooks").update({ failure_count: (h.failure_count ?? 0) + 1 }).eq("id", h.id);
    } catch { /* delivery logging best-effort */ }
  }
  return { delivered };
}
