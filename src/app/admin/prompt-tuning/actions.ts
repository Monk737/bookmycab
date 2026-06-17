// src/app/admin/prompt-tuning/actions.ts
"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { applySuggestion, rollbackRevision } from "@/lib/voice/prompt-tuning";

export type AdminPromptActionState = { ok: boolean; error?: string };

/**
 * FlowMo staff approve a tenant's requested prompt change: PATCH the Vapi
 * assistant and record the revision. Audited. Only this path mutates Vapi.
 */
export async function applyPromptSuggestion(input: { suggestionId: string }): Promise<AdminPromptActionState> {
  const claims = await requireStaff();
  const parsed = z.object({ suggestionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  // Capture the tenant for the audit row before mutating.
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await db
    .from("prompt_suggestions")
    .select("tenant_id, automation_id, reason")
    .eq("id", parsed.data.suggestionId)
    .maybeSingle();

  const res = await applySuggestion(parsed.data.suggestionId, claims.sub);
  if (!res.ok) return { ok: false, error: res.error ?? "Apply failed." };

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: sug?.tenant_id ?? null,
    action: "voice.prompt_apply",
    targetType: "automation",
    targetId: sug?.automation_id ?? null,
    metadata: { suggestion_id: parsed.data.suggestionId, revision_id: res.revisionId, reason: sug?.reason ?? null },
  });

  revalidatePath("/admin/prompt-tuning");
  return { ok: true };
}

/** FlowMo staff roll a live revision back to its previous prompt. Audited. */
export async function rollbackPromptRevision(input: { revisionId: string }): Promise<AdminPromptActionState> {
  const claims = await requireStaff();
  const parsed = z.object({ revisionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rev } = await db
    .from("prompt_revisions")
    .select("tenant_id, automation_id")
    .eq("id", parsed.data.revisionId)
    .maybeSingle();

  const res = await rollbackRevision(parsed.data.revisionId, claims.sub);
  if (!res.ok) return { ok: false, error: res.error ?? "Rollback failed." };

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: rev?.tenant_id ?? null,
    action: "voice.prompt_rollback",
    targetType: "automation",
    targetId: rev?.automation_id ?? null,
    metadata: { rolled_back_revision_id: parsed.data.revisionId, new_revision_id: res.revisionId },
  });

  revalidatePath("/admin/prompt-tuning");
  return { ok: true };
}

/** FlowMo staff decline a requested suggestion without applying it. */
export async function declinePromptSuggestion(input: { suggestionId: string }): Promise<AdminPromptActionState> {
  const claims = await requireStaff();
  const parsed = z.object({ suggestionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await db
    .from("prompt_suggestions")
    .select("tenant_id, automation_id")
    .eq("id", parsed.data.suggestionId)
    .eq("status", "requested")
    .maybeSingle();
  if (!sug) return { ok: false, error: "Request not found." };

  const { error } = await db
    .from("prompt_suggestions")
    .update({ status: "dismissed", resolved_by: claims.sub, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", parsed.data.suggestionId);
  if (error) return { ok: false, error: "Could not decline." };

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: sug.tenant_id,
    action: "voice.prompt_decline",
    targetType: "automation",
    targetId: sug.automation_id,
    metadata: { suggestion_id: parsed.data.suggestionId },
  });

  revalidatePath("/admin/prompt-tuning");
  return { ok: true };
}
