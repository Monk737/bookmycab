// src/lib/voice/prompt-tuning.ts
import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createSupabaseJS, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";
import { reviewReasons, type FlagInput } from "@/lib/voice/quality";
import { vapiConfigured, getSystemPrompt, setSystemPrompt } from "@/lib/voice/vapi";

const WINDOW_DAYS = 30;
const MIN_COUNT = 3; // a cluster must have at least this many flagged calls to suggest
const EVIDENCE_LIMIT = 5;

/* ------------------------------------------------------------------- types */

export interface RisingReason {
  reason: string;
  count: number;
  /** % change vs the prior equal-length window; null = brand new (no baseline). */
  deltaPct: number | null;
  /** count / totalCallsInWindow — the baseline flagged-rate stored on the suggestion. */
  flaggedRate: number;
}

export interface EvidenceCall {
  id: string;
  startedAt: string;
  outcome: string;
  callerName: string | null;
  summary: string | null;
}

export interface PromptSuggestion {
  id: string;
  tenantId: string;
  automationId: string;
  agentName: string;
  reason: string;
  reasonCount: number;
  reasonDeltaPct: number | null;
  oldPrompt: string;
  newPrompt: string;
  rationale: string | null;
  evidence: EvidenceCall[];
  status: "draft" | "requested" | "applied" | "dismissed" | "superseded";
  operatorNote: string | null;
  requestedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** Joined for the admin inbox. */
  tenantName?: string;
}

export interface PromptRevision {
  id: string;
  tenantId: string;
  automationId: string;
  agentName: string;
  vapiAssistantId: string;
  revision: number;
  oldPrompt: string;
  newPrompt: string;
  reason: string | null;
  rationale: string | null;
  kind: "apply" | "rollback";
  status: "active" | "superseded" | "rolled_back";
  baselineFlaggedRate: number | null;
  measuredFlaggedRate: number | null;
  measuredAt: string | null;
  appliedAt: string;
  tenantName?: string;
}

/* --------------------------------------------------------- pure selection */

/**
 * Pick the single failure reason that is rising hardest and worth drafting a fix
 * for. A reason qualifies when its current count ≥ `minCount` AND it rose vs the
 * prior window (or is brand new). Ranked by % rise (new reasons rank above any
 * finite rise). Returns null when nothing qualifies.
 */
export function pickRisingReason(
  cur: Record<string, number>,
  prev: Record<string, number>,
  totalCalls: number,
  minCount = MIN_COUNT,
): RisingReason | null {
  let best: RisingReason | null = null;
  let bestRank = -Infinity;
  for (const [reason, count] of Object.entries(cur)) {
    if (count < minCount) continue;
    const prevCount = prev[reason] ?? 0;
    const isNew = prevCount === 0;
    const deltaPct = isNew ? null : Math.round(((count - prevCount) / prevCount) * 100);
    const rising = isNew || (deltaPct ?? 0) > 0;
    if (!rising) continue;
    // New reasons rank above any finite rise; otherwise rank by % rise.
    const rank = isNew ? Number.MAX_SAFE_INTEGER : (deltaPct ?? 0);
    if (rank > bestRank) {
      bestRank = rank;
      best = { reason, count, deltaPct, flaggedRate: totalCalls > 0 ? count / totalCalls : 0 };
    }
  }
  return best;
}

/* ------------------------------------------------------------- LLM draft */

const DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    new_prompt: { type: Type.STRING, description: "The full revised system prompt. Keep the agent's voice, scope and structure; change only what reduces the named failure reason." },
    rationale: { type: Type.STRING, description: "One plain sentence naming what you changed and why it should reduce the failure." },
  },
  required: ["new_prompt", "rationale"],
  propertyOrdering: ["new_prompt", "rationale"],
};

const DRAFT_SYSTEM = [
  "You tune the system prompt of an AI phone agent for a UK private-hire (taxi) firm.",
  "You are given the agent's CURRENT system prompt, a rising failure reason, and short summaries of real calls that failed for that reason.",
  "Return a REVISED full system prompt that targets that one failure reason. Preserve everything that already works (tone, scope, structure, business rules); make the smallest change that plausibly reduces the failure.",
  "Plain British English. No buzzwords, no em dashes. Do not invent business facts not present in the current prompt.",
].join(" ");

async function draftRevision(
  oldPrompt: string,
  reason: RisingReason,
  evidence: EvidenceCall[],
): Promise<{ newPrompt: string; rationale: string; model: string } | null> {
  if (!env.GEMINI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const isFlash = env.BRIEFING_MODEL.includes("flash");
  const payload = {
    failure_reason: reason.reason,
    occurrences: reason.count,
    change_vs_prior_pct: reason.deltaPct,
    example_calls: evidence.map((e) => ({ outcome: e.outcome, summary: e.summary ?? "(no summary)" })),
    current_system_prompt: oldPrompt,
  };
  try {
    const res = await ai.models.generateContent({
      model: env.BRIEFING_MODEL,
      contents: `Revise the system prompt to reduce this failure.\n\n${JSON.stringify(payload)}`,
      config: {
        systemInstruction: DRAFT_SYSTEM,
        maxOutputTokens: isFlash ? 4096 : 8192,
        ...(isFlash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        responseMimeType: "application/json",
        responseSchema: DRAFT_SCHEMA,
      },
    });
    const parsed = JSON.parse(res.text ?? "") as { new_prompt: string; rationale: string };
    if (!parsed.new_prompt?.trim()) return null;
    return { newPrompt: parsed.new_prompt, rationale: parsed.rationale ?? "", model: env.BRIEFING_MODEL };
  } catch (e) {
    console.error("prompt-tuning draft failed", { reason: reason.reason, error: String((e as Error)?.message ?? e) });
    return null;
  }
}

/* ----------------------------------------------------------- the detector */

type AgentRow = { automation_id: string; display_name: string; vapi_assistant_id: string | null };
type CallRow = FlagInput & { id: string; started_at: string; caller_name: string | null; summary: string | null };

/**
 * Detect prompt-tuning suggestions for one tenant. For each Voice agent with a
 * Vapi assistant: cluster this window's flagged calls by reason vs the prior
 * window, pick the reason rising hardest, gather up to 5 evidence calls, fetch
 * the live system prompt, draft a revision with Gemini, and upsert a `draft`
 * suggestion (refreshing the open draft for that agent+reason; never clobbering a
 * suggestion already `requested` by the operator). Best-effort; never throws.
 */
export async function detectPromptSuggestions(tenantId: string): Promise<{ drafted: number; skipped: string[] }> {
  const skipped: string[] = [];
  if (!env.GEMINI_API_KEY) return { drafted: 0, skipped: ["no_gemini_key"] };
  if (!vapiConfigured()) return { drafted: 0, skipped: ["no_vapi_key"] };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: agentData } = await db
    .from("voice_agents")
    .select("automation_id, display_name, vapi_assistant_id")
    .eq("tenant_id", tenantId);
  const agents = ((agentData ?? []) as AgentRow[]).filter((a) => a.vapi_assistant_id);
  if (agents.length === 0) return { drafted: 0, skipped: ["no_wired_agents"] };

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
  const priorStart = new Date(now - 2 * WINDOW_DAYS * 86_400_000).toISOString();

  let drafted = 0;
  for (const agent of agents) {
    const { data: callData } = await db
      .from("calls")
      .select("id, started_at, outcome, duration_s, success, address_lookups, caller_name, summary")
      .eq("tenant_id", tenantId)
      .eq("automation_id", agent.automation_id)
      .gte("started_at", priorStart)
      .order("started_at", { ascending: false });
    const rows = (callData ?? []) as CallRow[];
    const cur = rows.filter((r) => r.started_at >= windowStart);
    const prev = rows.filter((r) => r.started_at < windowStart);

    const curCounts: Record<string, number> = {};
    for (const r of cur) for (const reason of reviewReasons(r).reasons) curCounts[reason] = (curCounts[reason] ?? 0) + 1;
    const prevCounts: Record<string, number> = {};
    for (const r of prev) for (const reason of reviewReasons(r).reasons) prevCounts[reason] = (prevCounts[reason] ?? 0) + 1;

    const rising = pickRisingReason(curCounts, prevCounts, cur.length);
    if (!rising) { skipped.push(`${agent.automation_id}:nothing_rising`); continue; }

    const evidence: EvidenceCall[] = cur
      .filter((r) => reviewReasons(r).reasons.includes(rising.reason))
      .sort((a, b) => reviewReasons(b).severity - reviewReasons(a).severity || (a.started_at < b.started_at ? 1 : -1))
      .slice(0, EVIDENCE_LIMIT)
      .map((r) => ({ id: r.id, startedAt: r.started_at, outcome: r.outcome, callerName: r.caller_name, summary: r.summary }));

    let oldPrompt: string;
    try {
      oldPrompt = await getSystemPrompt(agent.vapi_assistant_id as string);
    } catch (e) {
      console.error("prompt-tuning: getSystemPrompt failed", { assistant: agent.vapi_assistant_id, error: String((e as Error)?.message ?? e) });
      skipped.push(`${agent.automation_id}:vapi_read_failed`);
      continue;
    }

    const draft = await draftRevision(oldPrompt, rising, evidence);
    if (!draft) { skipped.push(`${agent.automation_id}:draft_failed`); continue; }

    // Refresh the open draft for this agent+reason; never clobber a 'requested' one.
    const { data: existing } = await db
      .from("prompt_suggestions")
      .select("id, status")
      .eq("automation_id", agent.automation_id)
      .eq("reason", rising.reason)
      .in("status", ["draft", "requested"])
      .maybeSingle();
    if (existing?.status === "requested") { skipped.push(`${agent.automation_id}:awaiting_admin`); continue; }

    const fields = {
      tenant_id: tenantId,
      automation_id: agent.automation_id,
      vapi_assistant_id: agent.vapi_assistant_id,
      reason: rising.reason,
      reason_count: rising.count,
      reason_delta_pct: rising.deltaPct,
      baseline_flagged_rate: rising.flaggedRate,
      old_prompt: oldPrompt,
      new_prompt: draft.newPrompt,
      rationale: draft.rationale,
      evidence_call_ids: evidence.map((e) => e.id),
      model: draft.model,
      status: "draft" as const,
      updated_at: new Date().toISOString(),
    };
    const res = existing
      ? await db.from("prompt_suggestions").update(fields).eq("id", existing.id)
      : await db.from("prompt_suggestions").insert(fields);
    if (res.error) { skipped.push(`${agent.automation_id}:write_failed`); continue; }
    drafted++;
  }
  return { drafted, skipped };
}

/**
 * Detect across every tenant with a wired Voice agent (cron entrypoint). Pass a
 * `tenantId` to scope the sweep to a single tenant (per-tenant cloned cron);
 * omit it to sweep all tenants (single platform cron).
 */
export async function detectAllPromptSuggestions(tenantId?: string): Promise<{ tenants: number; drafted: number }> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  let tenantIds: string[];
  if (tenantId) {
    tenantIds = [tenantId];
  } else {
    const { data } = await db.from("voice_agents").select("tenant_id").not("vapi_assistant_id", "is", null);
    tenantIds = [...new Set(((data ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id))];
  }
  let drafted = 0;
  for (const id of tenantIds) drafted += (await detectPromptSuggestions(id)).drafted;
  return { tenants: tenantIds.length, drafted };
}

/* ------------------------------------------------------------------ reads */

type SuggestionRow = {
  id: string; tenant_id: string; automation_id: string; reason: string;
  reason_count: number; reason_delta_pct: number | null; old_prompt: string;
  new_prompt: string; rationale: string | null; evidence_call_ids: string[];
  status: PromptSuggestion["status"]; operator_note: string | null;
  requested_at: string | null; resolved_at: string | null; created_at: string;
  voice_agents?: { display_name: string } | null;
  tenants?: { name: string } | null;
};

async function hydrateEvidence(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, EvidenceCall>> {
  if (ids.length === 0) return new Map();
  const { data } = await db
    .from("calls")
    .select("id, started_at, outcome, caller_name, summary")
    .in("id", ids);
  return new Map(
    ((data ?? []) as { id: string; started_at: string; outcome: string; caller_name: string | null; summary: string | null }[]).map(
      (r) => [r.id, { id: r.id, startedAt: r.started_at, outcome: r.outcome, callerName: r.caller_name, summary: r.summary }],
    ),
  );
}

function toSuggestion(row: SuggestionRow, evidence: EvidenceCall[]): PromptSuggestion {
  return {
    id: row.id, tenantId: row.tenant_id, automationId: row.automation_id,
    agentName: row.voice_agents?.display_name ?? "Voice agent",
    reason: row.reason, reasonCount: row.reason_count, reasonDeltaPct: row.reason_delta_pct,
    oldPrompt: row.old_prompt, newPrompt: row.new_prompt, rationale: row.rationale,
    evidence, status: row.status, operatorNote: row.operator_note,
    requestedAt: row.requested_at, resolvedAt: row.resolved_at, createdAt: row.created_at,
    tenantName: row.tenants?.name,
  };
}

const SUGGESTION_COLS =
  "id, tenant_id, automation_id, reason, reason_count, reason_delta_pct, old_prompt, new_prompt, rationale, evidence_call_ids, status, operator_note, requested_at, resolved_at, created_at, voice_agents(display_name)";

/** Active suggestions for the tenant panel (draft + requested + recently applied). */
export async function getPromptSuggestions(tenantId: string): Promise<PromptSuggestion[]> {
  const supabase = await createClient(); // RLS-scoped
  const { data } = await supabase
    .from("prompt_suggestions")
    .select(SUGGESTION_COLS)
    .eq("tenant_id", tenantId)
    .in("status", ["draft", "requested", "applied"])
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as unknown as SuggestionRow[];
  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const ev = await hydrateEvidence(svc, [...new Set(rows.flatMap((r) => r.evidence_call_ids))]);
  return rows.map((r) => toSuggestion(r, r.evidence_call_ids.map((id) => ev.get(id)).filter((x): x is EvidenceCall => !!x)));
}

/**
 * The admin inbox across all tenants — both auto-detected `draft` suggestions
 * (surfaced by the daily cron so staff can refine proactively) and tenant-raised
 * `requested` ones. Tenant-raised sort first (oldest waiting at the top), then
 * fresh auto-detected drafts. Service role.
 */
export async function getAdminInboxSuggestions(): Promise<PromptSuggestion[]> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db
    .from("prompt_suggestions")
    .select(`${SUGGESTION_COLS}, tenants(name)`)
    .in("status", ["draft", "requested"])
    .order("requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as SuggestionRow[];
  const ev = await hydrateEvidence(db, [...new Set(rows.flatMap((r) => r.evidence_call_ids))]);
  return rows.map((r) => toSuggestion(r, r.evidence_call_ids.map((id) => ev.get(id)).filter((x): x is EvidenceCall => !!x)));
}

/* ----------------------------------------------------- revisions (reads) */

type RevisionRow = {
  id: string; tenant_id: string; automation_id: string; vapi_assistant_id: string;
  revision: number; old_prompt: string; new_prompt: string; reason: string | null;
  rationale: string | null; kind: PromptRevision["kind"]; status: PromptRevision["status"];
  baseline_flagged_rate: number | null; measured_flagged_rate: number | null;
  measured_at: string | null; applied_at: string;
  voice_agents?: { display_name: string } | null;
  tenants?: { name: string } | null;
};

function toRevision(r: RevisionRow): PromptRevision {
  return {
    id: r.id, tenantId: r.tenant_id, automationId: r.automation_id, vapiAssistantId: r.vapi_assistant_id,
    agentName: r.voice_agents?.display_name ?? "Voice agent",
    revision: r.revision, oldPrompt: r.old_prompt, newPrompt: r.new_prompt, reason: r.reason,
    rationale: r.rationale, kind: r.kind, status: r.status,
    baselineFlaggedRate: r.baseline_flagged_rate, measuredFlaggedRate: r.measured_flagged_rate,
    measuredAt: r.measured_at, appliedAt: r.applied_at, tenantName: r.tenants?.name,
  };
}

const REVISION_COLS =
  "id, tenant_id, automation_id, vapi_assistant_id, revision, old_prompt, new_prompt, reason, rationale, kind, status, baseline_flagged_rate, measured_flagged_rate, measured_at, applied_at, voice_agents(display_name)";

/** Currently-live revisions across all assistants — the admin "active" list. Service role. */
export async function getActiveRevisions(): Promise<PromptRevision[]> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db
    .from("prompt_revisions")
    .select(`${REVISION_COLS}, tenants(name)`)
    .eq("status", "active")
    .order("applied_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as RevisionRow[]).map(toRevision);
}

/* ------------------------------------------------ apply / rollback (Vapi) */

const AUTO_ROLLBACK_DWELL_DAYS = 14; // wait this long after apply before measuring
const AUTO_ROLLBACK_WORSE_RATIO = 1.25; // measured rate 25%+ worse than baseline → auto-rollback

export type ApplyResult = { ok: boolean; error?: string; revisionId?: string };

/** Next revision number for an assistant (service-role; low write rate). */
async function nextRevision(db: SupabaseClient, assistantId: string): Promise<number> {
  const { data } = await db
    .from("prompt_revisions")
    .select("revision")
    .eq("vapi_assistant_id", assistantId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { revision: number } | null)?.revision ?? 0) + 1;
}

/**
 * Apply a requested suggestion: re-read the live prompt (source of truth for the
 * "old" side), PATCH Vapi to the new prompt, write an `apply` revision (marking
 * any prior active revision for that assistant superseded), and mark the
 * suggestion applied. Service-role internals; the admin action wraps it with
 * requireStaff + audit. `actorUserId` is the staff user id for the trail.
 */
export async function applySuggestion(suggestionId: string, actorUserId: string): Promise<ApplyResult> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await db
    .from("prompt_suggestions")
    .select("id, tenant_id, automation_id, vapi_assistant_id, reason, rationale, new_prompt, baseline_flagged_rate, status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!sug) return { ok: false, error: "Suggestion not found." };
  // Admin can apply a tenant-raised `requested` one or an auto-detected `draft`
  // directly (auto-surface). Already-applied/dismissed/superseded are no-ops.
  if (sug.status !== "requested" && sug.status !== "draft") {
    return { ok: false, error: "Only open suggestions can be applied." };
  }
  if (!sug.vapi_assistant_id) return { ok: false, error: "This agent has no Vapi assistant wired." };

  // Live prompt is the true "old" side (the snapshot may have drifted).
  let oldPrompt: string;
  try {
    oldPrompt = await getSystemPrompt(sug.vapi_assistant_id);
  } catch (e) {
    return { ok: false, error: `Could not read the live prompt: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }
  // Vapi is the external source of truth, so we patch it before the DB writes.
  // If a later DB write fails we return "saved to Vapi but failed to record the
  // revision" so the admin can re-check rather than the two silently diverging.
  try {
    await setSystemPrompt(sug.vapi_assistant_id, sug.new_prompt);
  } catch (e) {
    return { ok: false, error: `Vapi update failed: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }

  await db
    .from("prompt_revisions")
    .update({ status: "superseded" })
    .eq("vapi_assistant_id", sug.vapi_assistant_id)
    .eq("status", "active");

  const revision = await nextRevision(db, sug.vapi_assistant_id);
  const { data: rev, error: revErr } = await db
    .from("prompt_revisions")
    .insert({
      tenant_id: sug.tenant_id,
      automation_id: sug.automation_id,
      vapi_assistant_id: sug.vapi_assistant_id,
      revision,
      old_prompt: oldPrompt,
      new_prompt: sug.new_prompt,
      reason: sug.reason,
      rationale: sug.rationale,
      source_suggestion_id: sug.id,
      kind: "apply",
      status: "active",
      baseline_flagged_rate: sug.baseline_flagged_rate,
      applied_by: actorUserId,
    })
    .select("id")
    .single();
  if (revErr || !rev) return { ok: false, error: "Saved to Vapi but failed to record the revision." };

  await db
    .from("prompt_suggestions")
    .update({ status: "applied", resolved_by: actorUserId, resolved_at: new Date().toISOString(), revision_id: rev.id, updated_at: new Date().toISOString() })
    .eq("id", sug.id);

  return { ok: true, revisionId: rev.id };
}

/**
 * Roll an active `apply` revision back to its previous prompt: PATCH Vapi to the
 * revision's `old_prompt`, mark that revision `rolled_back`, and write a new
 * `rollback` revision (active) pointing at it via parent_revision_id. When
 * `actorUserId` is null the rollback was automatic (the measure sweep).
 */
export async function rollbackRevision(revisionId: string, actorUserId: string | null): Promise<ApplyResult> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: target } = await db
    .from("prompt_revisions")
    .select("id, tenant_id, automation_id, vapi_assistant_id, old_prompt, new_prompt, reason, status, baseline_flagged_rate")
    .eq("id", revisionId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Revision not found." };
  if (target.status !== "active") return { ok: false, error: "Only the active revision can be rolled back." };

  try {
    await setSystemPrompt(target.vapi_assistant_id, target.old_prompt);
  } catch (e) {
    return { ok: false, error: `Vapi rollback failed: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }

  await db.from("prompt_revisions").update({ status: "rolled_back" }).eq("id", target.id);
  // Defensive: by invariant the target was the only active revision for this
  // assistant, but supersede any stragglers so exactly one revision stays active.
  await db
    .from("prompt_revisions")
    .update({ status: "superseded" })
    .eq("vapi_assistant_id", target.vapi_assistant_id)
    .eq("status", "active");

  const revision = await nextRevision(db, target.vapi_assistant_id);
  const { data: rev, error: revErr } = await db
    .from("prompt_revisions")
    .insert({
      tenant_id: target.tenant_id,
      automation_id: target.automation_id,
      vapi_assistant_id: target.vapi_assistant_id,
      revision,
      old_prompt: target.new_prompt, // we were on new_prompt; restoring old_prompt
      new_prompt: target.old_prompt,
      reason: target.reason,
      rationale: actorUserId ? "Manual rollback to the previous prompt." : "Auto-rollback: failure rate worsened after the change.",
      kind: "rollback",
      parent_revision_id: target.id,
      status: "active",
      baseline_flagged_rate: target.baseline_flagged_rate,
      applied_by: actorUserId,
    })
    .select("id")
    .single();
  if (revErr || !rev) return { ok: false, error: "Rolled back in Vapi but failed to record the revision." };
  return { ok: true, revisionId: rev.id };
}

/**
 * Measure each active `apply` revision past its dwell window: compute the reason's
 * post-apply flagged-rate and store it. If it worsened beyond the threshold,
 * auto-roll-back. Returns counts for the cron summary. Best-effort.
 */
export async function measureRevisions(tenantId?: string): Promise<{ measured: number; autoRolledBack: number }> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const dwellCutoff = new Date(Date.now() - AUTO_ROLLBACK_DWELL_DAYS * 86_400_000).toISOString();
  let q = db
    .from("prompt_revisions")
    .select("id, tenant_id, automation_id, reason, baseline_flagged_rate, applied_at")
    .eq("status", "active")
    .eq("kind", "apply")
    .is("measured_at", null)
    .lte("applied_at", dwellCutoff);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  const rows = (data ?? []) as {
    id: string; tenant_id: string; automation_id: string; reason: string | null;
    baseline_flagged_rate: number | null; applied_at: string;
  }[];

  let measured = 0;
  let autoRolledBack = 0;
  for (const r of rows) {
    if (!r.reason) continue;
    const { data: callData } = await db
      .from("calls")
      .select("outcome, duration_s, success, address_lookups")
      .eq("tenant_id", r.tenant_id)
      .eq("automation_id", r.automation_id)
      .gte("started_at", r.applied_at);
    const calls = (callData ?? []) as FlagInput[];
    if (calls.length === 0) continue;
    const flagged = calls.filter((c) => reviewReasons(c).reasons.includes(r.reason as string)).length;
    const rate = flagged / calls.length;
    await db.from("prompt_revisions").update({ measured_flagged_rate: rate, measured_at: new Date().toISOString() }).eq("id", r.id);
    measured++;
    const baseline = r.baseline_flagged_rate ?? 0;
    if (baseline > 0 && rate > baseline * AUTO_ROLLBACK_WORSE_RATIO) {
      const res = await rollbackRevision(r.id, null);
      if (res.ok) autoRolledBack++;
    }
  }
  return { measured, autoRolledBack };
}
