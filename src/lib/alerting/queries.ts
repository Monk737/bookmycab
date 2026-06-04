import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AlertRuleRow {
  id: string; tenant_id: string; automation_id: string | null; name: string;
  metric: string; operator: "gt" | "gte" | "lt" | "lte"; threshold: number;
  window_hours: number; severity: string; enabled: boolean;
}
export interface ChannelRow { id: string; type: string; destination: string; enabled: boolean; verified: boolean }

export async function listEnabledRules(tenantId: string): Promise<AlertRuleRow[]> {
  const { data } = await svc().from("alert_rules").select("*").eq("tenant_id", tenantId).eq("enabled", true);
  return (data ?? []) as AlertRuleRow[];
}
export async function listRules(tenantId: string): Promise<AlertRuleRow[]> {
  const { data } = await svc().from("alert_rules").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as AlertRuleRow[];
}
export async function listEnabledChannels(tenantId: string): Promise<ChannelRow[]> {
  const { data } = await svc().from("notification_channels").select("*").eq("tenant_id", tenantId).eq("enabled", true);
  return (data ?? []) as ChannelRow[];
}
export async function listChannels(tenantId: string): Promise<ChannelRow[]> {
  const { data } = await svc().from("notification_channels").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as ChannelRow[];
}
export async function insertAlertEvent(tenantId: string, ruleId: string, value: number): Promise<{ id: string }> {
  const { data } = await svc().from("alert_events").insert({ tenant_id: tenantId, rule_id: ruleId, value }).select("id").single();
  return { id: (data?.id as string) ?? "" };
}
export async function createRule(tenantId: string, input: Partial<AlertRuleRow> & { createdBy?: string }): Promise<void> {
  await svc().from("alert_rules").insert({
    tenant_id: tenantId, automation_id: input.automation_id ?? null, name: input.name,
    metric: input.metric, operator: input.operator, threshold: input.threshold,
    window_hours: input.window_hours ?? 24, severity: input.severity ?? "warning",
    created_by: input.createdBy ?? null,
  });
}
export async function setRuleEnabled(tenantId: string, ruleId: string, enabled: boolean): Promise<void> {
  await svc().from("alert_rules").update({ enabled, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", ruleId);
}
export async function deleteRule(tenantId: string, ruleId: string): Promise<void> {
  await svc().from("alert_rules").delete().eq("tenant_id", tenantId).eq("id", ruleId);
}
export async function createChannel(tenantId: string, type: string, destination: string): Promise<void> {
  await svc().from("notification_channels").insert({ tenant_id: tenantId, type, destination });
}
export async function listRecentEvents(tenantId: string, limit = 20): Promise<{ id: string; rule_id: string; value: number; fired_at: string }[]> {
  const { data } = await svc().from("alert_events").select("id, rule_id, value, fired_at").eq("tenant_id", tenantId).order("fired_at", { ascending: false }).limit(limit);
  return (data ?? []) as { id: string; rule_id: string; value: number; fired_at: string }[];
}
