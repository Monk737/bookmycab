import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const SENDER_TYPES = ["email", "sms", "slack"];

/** Pure: validate a notification-sender input. */
export function validateSender(input: { type: string; identifier: string }): { ok: boolean; error?: string } {
  if (!SENDER_TYPES.includes(input.type)) return { ok: false, error: "Unknown sender type." };
  if (!input.identifier || !input.identifier.trim()) return { ok: false, error: "Identifier is required." };
  return { ok: true };
}

/** Pure: validate a channel-app input. */
export function validateApp(input: { provider: string; identifier: string }): { ok: boolean; error?: string } {
  if (!input.provider || !input.provider.trim()) return { ok: false, error: "Provider is required." };
  if (!input.identifier || !input.identifier.trim()) return { ok: false, error: "Identifier is required." };
  return { ok: true };
}

// ── Commission rates (latest per tenant) ────────────────────────────────────
export interface TenantCommission { tenantId: string; name: string; pct: number | null }

export async function listCommission(): Promise<TenantCommission[]> {
  const sb = svc();
  const [{ data: tenants }, { data: rates }] = await Promise.all([
    sb.from("tenants").select("id, name").order("name"),
    sb.from("commission_rates").select("tenant_id, pct, effective_from").order("effective_from", { ascending: false }),
  ]);
  const latest = new Map<string, number>();
  for (const r of rates ?? []) if (!latest.has(r.tenant_id as string)) latest.set(r.tenant_id as string, Number(r.pct));
  return (tenants ?? []).map((t) => ({ tenantId: t.id as string, name: (t.name as string) ?? "", pct: latest.get(t.id as string) ?? null }));
}

export async function setCommission(tenantId: string, pct: number): Promise<void> {
  await svc().from("commission_rates").insert({ tenant_id: tenantId, pct, effective_from: new Date().toISOString().slice(0, 10) });
}

// ── Channel apps (platform_apps) ────────────────────────────────────────────
export interface AppRow { id: string; provider: string; identifier: string; status: string }

export async function listApps(): Promise<AppRow[]> {
  const { data } = await svc().from("platform_apps").select("id, provider, identifier, status").order("created_at", { ascending: false });
  return (data ?? []) as AppRow[];
}
export async function createApp(provider: string, identifier: string): Promise<{ ok: boolean; error?: string }> {
  const v = validateApp({ provider, identifier });
  if (!v.ok) return v;
  await svc().from("platform_apps").insert({ provider, identifier });
  return { ok: true };
}
export async function setAppStatus(id: string, status: "active" | "disabled"): Promise<void> {
  await svc().from("platform_apps").update({ status }).eq("id", id);
}

// ── Notification senders (platform_senders) ─────────────────────────────────
export interface SenderRow { id: string; type: string; identifier: string; provider: string | null; status: string }

export async function listSenders(): Promise<SenderRow[]> {
  const { data } = await svc().from("platform_senders").select("id, type, identifier, provider, status").order("created_at", { ascending: false });
  return (data ?? []) as SenderRow[];
}
export async function createSender(type: string, identifier: string, provider: string | null): Promise<{ ok: boolean; error?: string }> {
  const v = validateSender({ type, identifier });
  if (!v.ok) return v;
  await svc().from("platform_senders").insert({ type, identifier, provider });
  return { ok: true };
}
export async function setSenderStatus(id: string, status: "active" | "disabled"): Promise<void> {
  await svc().from("platform_senders").update({ status }).eq("id", id);
}
