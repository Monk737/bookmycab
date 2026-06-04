import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { listGuardrails } from "./guardrail-queries";
import { validateConfig, type Violation } from "./guardrails";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface VersionRow {
  id: string; version: number; status: string; change_note: string | null;
  published_at: string | null; created_at: string;
}

/** Reads the current live config row from automation_config. */
export async function getLiveConfig(automationId: string): Promise<Record<string, unknown> | null> {
  const { data } = await svc().from("automation_config").select("*").eq("automation_id", automationId).maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

export async function listVersions(automationId: string): Promise<VersionRow[]> {
  const { data } = await svc().from("config_versions").select("id, version, status, change_note, published_at, created_at").eq("automation_id", automationId).order("version", { ascending: false });
  return (data ?? []) as VersionRow[];
}

/** Create a draft snapshot of `config` as the next version number. */
export async function createDraft(args: { tenantId: string; automationId: string; config: Record<string, unknown>; changeNote?: string; createdBy: string }): Promise<{ id: string; version: number }> {
  const sb = svc();
  const { data: maxRow } = await sb.from("config_versions").select("version").eq("automation_id", args.automationId).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = ((maxRow?.version as number) ?? 0) + 1;
  const { data } = await sb.from("config_versions").insert({
    automation_id: args.automationId, tenant_id: args.tenantId, version: nextVersion,
    config: args.config, status: "draft", change_note: args.changeNote ?? null, created_by: args.createdBy,
  }).select("id, version").single();
  return { id: data?.id as string, version: data?.version as number };
}

/**
 * Publish a draft: validate its config against guardrails, copy the snapshot
 * into automation_config (the live config the engine reads), mark the version
 * published + synced. Returns violations on failure (nothing is published).
 */
export async function publishVersion(args: { tenantId: string; automationId: string; versionId: string; publishedBy: string }): Promise<{ ok: boolean; violations?: Violation[] }> {
  const sb = svc();
  const { data: version } = await sb.from("config_versions").select("*").eq("id", args.versionId).eq("automation_id", args.automationId).maybeSingle();
  if (!version) return { ok: false };
  const candidate = (version.config as Record<string, unknown>) ?? {};

  const live = (await getLiveConfig(args.automationId)) ?? {};
  const guardrails = await listGuardrails(args.automationId);
  // numeric fields we currently bound: min_fare lives in fare_rules, not config,
  // so the numericValues map is built from any numeric top-level config fields.
  const numericValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(candidate)) if (typeof v === "number") numericValues[k] = v;
  const check = validateConfig(numericValues, guardrails, candidate, live);
  if (!check.ok) return { ok: false, violations: check.violations };

  const now = new Date().toISOString();
  // Copy snapshot into the live automation_config (only known editable columns).
  await sb.from("automation_config").update({
    welcome_messages: candidate.welcome_messages ?? {},
    vehicle_types: candidate.vehicle_types ?? [],
    service_area: candidate.service_area ?? null,
    opening_hours: candidate.opening_hours ?? {},
    brand_colours: candidate.brand_colours ?? {},
    languages: candidate.languages ?? ["en"],
    ask_driver_note: candidate.ask_driver_note ?? false,
    current_version_id: args.versionId,
    updated_by: args.publishedBy,
    updated_at: now,
  }).eq("automation_id", args.automationId);

  // Mark previously-published versions archived, then this one published.
  await sb.from("config_versions").update({ status: "archived" }).eq("automation_id", args.automationId).eq("status", "published");
  await sb.from("config_versions").update({ status: "published", published_by: args.publishedBy, published_at: now, synced_to_engine_at: now }).eq("id", args.versionId);
  return { ok: true };
}

/** Roll back: create a new draft from an old version's config, then publish it. */
export async function rollbackTo(args: { tenantId: string; automationId: string; versionId: string; userId: string }): Promise<{ ok: boolean; violations?: Violation[] }> {
  const sb = svc();
  const { data: old } = await sb.from("config_versions").select("config").eq("id", args.versionId).eq("automation_id", args.automationId).maybeSingle();
  if (!old) return { ok: false };
  const draft = await createDraft({ tenantId: args.tenantId, automationId: args.automationId, config: old.config as Record<string, unknown>, changeNote: `Rollback to version`, createdBy: args.userId });
  return publishVersion({ tenantId: args.tenantId, automationId: args.automationId, versionId: draft.id, publishedBy: args.userId });
}

export async function deleteDraft(tenantId: string, versionId: string): Promise<void> {
  await svc().from("config_versions").delete().eq("tenant_id", tenantId).eq("id", versionId).eq("status", "draft");
}
