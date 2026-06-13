import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { validateChannelRequest, nextProvisioningState, type ProvisioningStatus, type ProvisioningAction } from "./provision";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface TenantChannelRow {
  id: string; type: string; external_id: string | null; status: string;
  provisioning_status: string; is_self_serve: boolean; automation_id: string; created_at: string;
}
export interface PendingChannelRow extends TenantChannelRow { tenant_id: string }

/** The tenant's automations (id + name), used by the Connect page's request form. */
export async function listTenantAutomations(tenantId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await svc().from("automations").select("id, name").eq("tenant_id", tenantId).order("name");
  return (data ?? []) as { id: string; name: string }[];
}

/**
 * Self-serve channel request: validates, confirms the automation belongs to the
 * tenant, then inserts a pending_review channel. Returns the new id or errors.
 */
export async function requestChannel(args: { tenantId: string; type: string; externalId: string; automationId: string; createdBy: string }): Promise<{ ok: boolean; id?: string; errors?: string[] }> {
  const v = validateChannelRequest({ type: args.type, externalId: args.externalId, automationId: args.automationId });
  if (!v.ok) return { ok: false, errors: v.errors };
  const sb = svc();
  const { data: automation } = await sb.from("automations").select("id").eq("tenant_id", args.tenantId).eq("id", args.automationId).maybeSingle();
  if (!automation) return { ok: false, errors: ["automationId"] };

  const { data, error } = await sb.from("channels").insert({
    tenant_id: args.tenantId, automation_id: args.automationId, type: args.type, external_id: args.externalId,
    webhook_path: `/webhooks/${args.type}/${args.automationId}`, status: "disconnected",
    provisioning_status: "pending_review", is_self_serve: true, created_by: args.createdBy,
  }).select("id").single();
  if (error) return { ok: false, errors: ["insert"] };
  return { ok: true, id: data?.id as string };
}

export async function listTenantChannels(tenantId: string): Promise<TenantChannelRow[]> {
  const { data } = await svc().from("channels").select("id, type, external_id, status, provisioning_status, is_self_serve, automation_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as TenantChannelRow[];
}

export async function listPendingChannels(): Promise<PendingChannelRow[]> {
  const { data } = await svc().from("channels").select("id, tenant_id, type, external_id, status, provisioning_status, is_self_serve, automation_id, created_at").eq("provisioning_status", "pending_review").order("created_at");
  return (data ?? []) as PendingChannelRow[];
}

/** Channel row enriched with tenant + automation names for the review console. */
export interface ReviewChannelRow extends PendingChannelRow {
  tenant_name: string | null;
  automation_name: string | null;
  token_expires_at: string | null;
}

const REVIEW_SELECT =
  "id, tenant_id, type, external_id, status, provisioning_status, is_self_serve, automation_id, created_at, token_expires_at, tenants(name), automations(name)";

function flattenReview(rows: Record<string, unknown>[]): ReviewChannelRow[] {
  return rows.map((r) => {
    const t = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
    const a = Array.isArray(r.automations) ? r.automations[0] : r.automations;
    return {
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      type: r.type as string,
      external_id: (r.external_id as string | null) ?? null,
      status: r.status as string,
      provisioning_status: r.provisioning_status as string,
      is_self_serve: Boolean(r.is_self_serve),
      automation_id: r.automation_id as string,
      created_at: r.created_at as string,
      token_expires_at: (r.token_expires_at as string | null) ?? null,
      tenant_name: ((t as { name?: string } | null)?.name as string | null) ?? null,
      automation_name: ((a as { name?: string } | null)?.name as string | null) ?? null,
    };
  });
}

/** Pending channels with tenant + automation names attached. */
export async function listPendingChannelsForReview(): Promise<ReviewChannelRow[]> {
  const { data } = await svc()
    .from("channels")
    .select(REVIEW_SELECT)
    .eq("provisioning_status", "pending_review")
    .order("created_at");
  return flattenReview((data ?? []) as Record<string, unknown>[]);
}

/** Recently actioned channels (approved or rejected) for an at-a-glance audit. */
export async function listRecentlyReviewedChannels(limit = 8): Promise<ReviewChannelRow[]> {
  const { data } = await svc()
    .from("channels")
    .select(REVIEW_SELECT)
    .in("provisioning_status", ["approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return flattenReview((data ?? []) as Record<string, unknown>[]);
}

/** Admin approve/reject: transitions a pending channel; approval also marks it active. */
export async function setProvisioning(channelId: string, action: ProvisioningAction): Promise<{ ok: boolean; status?: ProvisioningStatus }> {
  const sb = svc();
  const { data: ch } = await sb.from("channels").select("provisioning_status").eq("id", channelId).maybeSingle();
  if (!ch) return { ok: false };
  const current = (ch.provisioning_status as ProvisioningStatus) ?? "pending_review";
  const next = nextProvisioningState(current, action);
  const patch: Record<string, unknown> = { provisioning_status: next };
  if (next === "approved") patch.status = "active";
  if (next === "rejected") patch.status = "disconnected";
  await sb.from("channels").update(patch).eq("id", channelId);
  return { ok: true, status: next };
}
