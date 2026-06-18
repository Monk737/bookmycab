"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/env";
import { RECORDINGS_BUCKET } from "@/lib/voice/archive-recording";
import { detectPromptSuggestions } from "@/lib/voice/prompt-tuning";

export interface CallTranscript {
  ok: boolean;
  transcript: string | null;
  recordingUrl: string | null;
  startedAt: string | null;
  caller: string | null;
  callerName: string | null;
  outcome: string | null;
  durationS: number | null;
  summary: string | null;
  error?: string;
}

const schema = z.object({ callId: z.string().uuid() });

/**
 * Fetch a single call's transcript + recording on demand (keeps the page payload
 * light). RLS-scoped through the server client: the row must belong to the
 * caller's tenant, so no extra tenant filter is needed.
 */
export async function getCallTranscript(callId: string): Promise<CallTranscript> {
  const empty: CallTranscript = {
    ok: false, transcript: null, recordingUrl: null, startedAt: null,
    caller: null, callerName: null, outcome: null, durationS: null, summary: null,
  };
  const claims = await requireUser();
  if (!claims.tenant_id) return { ...empty, error: "No organisation linked." };

  const parsed = schema.safeParse({ callId });
  if (!parsed.success) return { ...empty, error: "Invalid call." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calls")
    .select("transcript, recording_url, started_at, caller_number, caller_name, outcome, duration_s, summary")
    .eq("id", parsed.data.callId)
    .maybeSingle();

  if (error || !data) return { ...empty, error: "Call not found." };

  // Prefer our durable archived copy (a short-lived signed URL) over the
  // provider URL on the call row, which expires with the provider's retention.
  // RLS above already proved this call belongs to the caller's tenant; the
  // artifact read is RLS-scoped too, and signing the object is server-only.
  let recordingUrl = data.recording_url ?? null;
  const { data: artifact } = await supabase
    .from("call_artifacts")
    .select("status, storage_path")
    .eq("call_id", parsed.data.callId)
    .maybeSingle();
  if (artifact?.status === "archived" && artifact.storage_path) {
    const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: signed } = await svc.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrl(artifact.storage_path, 60 * 60);
    if (signed?.signedUrl) recordingUrl = signed.signedUrl;
  }

  return {
    ok: true,
    transcript: data.transcript ?? null,
    recordingUrl,
    startedAt: data.started_at ?? null,
    caller: data.caller_number ?? null,
    callerName: data.caller_name ?? null,
    outcome: data.outcome ?? null,
    durationS: data.duration_s ?? null,
    summary: data.summary ?? null,
  };
}

const reviewSchema = z.object({
  callId: z.string().uuid(),
  status: z.enum(["open", "reviewed", "dismissed"]),
});

export type ReviewActionState = { ok: boolean; error?: string };

/**
 * Triage a flagged call: mark it reviewed or dismissed so it leaves the
 * "Calls to review" queue (or reopen it). Tenant-scoped — the call must belong to
 * the caller's tenant. Service role (call_reviews has no write policy); audited by
 * actioned_by / actioned_at.
 */
export async function updateCallReviewStatus(input: { callId: string; status: string }): Promise<ReviewActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  // Confirm the call is this tenant's before recording any triage state.
  const { data: call } = await svc
    .from("calls")
    .select("id")
    .eq("id", parsed.data.callId)
    .eq("tenant_id", claims.tenant_id)
    .maybeSingle();
  if (!call) return { ok: false, error: "Call not found." };

  const { error } = await svc.from("call_reviews").upsert(
    {
      call_id: parsed.data.callId,
      tenant_id: claims.tenant_id,
      status: parsed.data.status,
      actioned_by: claims.sub,
      actioned_at: new Date().toISOString(),
    },
    { onConflict: "call_id" },
  );
  if (error) {
    console.error("updateCallReviewStatus failed", error);
    return { ok: false, error: "Could not update the review." };
  }

  revalidatePath("/dashboard/voice/quality");
  return { ok: true };
}

export type PromptActionState = { ok: boolean; error?: string; message?: string };

/**
 * Run the prompt-tuning detector for the caller's tenant on demand (the panel's
 * "Check for suggestions" button). Owner/Admin only, never in demo. Best-effort:
 * surfaces a friendly message rather than throwing.
 */
export async function runPromptDetection(): Promise<PromptActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };
  if (claims.role === "Viewer") return { ok: false, error: "Owners and admins can run prompt tuning." };

  const res = await detectPromptSuggestions(claims.tenant_id);
  revalidatePath("/dashboard/voice/quality");
  if (res.drafted > 0) return { ok: true, message: `${res.drafted} suggestion${res.drafted === 1 ? "" : "s"} ready to review.` };
  if (res.skipped.includes("no_gemini_key") || res.skipped.includes("no_vapi_key"))
    return { ok: true, message: "Prompt tuning isn't configured yet, contact FlowMo." };
  return { ok: true, message: "No new tuning suggestions right now." };
}

const requestSchema = z.object({
  suggestionId: z.string().uuid(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Operator raises a draft suggestion to FlowMo admin for approval. Moves the
 * suggestion draft → requested, stamping who/when + an optional note. Only FlowMo
 * staff can actually apply it (that PATCHes Vapi). Owner/Admin only, never demo.
 */
export async function requestPromptSuggestion(input: { suggestionId: string; note?: string }): Promise<PromptActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };
  if (claims.role === "Viewer") return { ok: false, error: "Owners and admins can raise a change." };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await svc
    .from("prompt_suggestions")
    .select("id, status")
    .eq("id", parsed.data.suggestionId)
    .eq("tenant_id", claims.tenant_id)
    .maybeSingle();
  if (!sug) return { ok: false, error: "Suggestion not found." };
  if (sug.status !== "draft") return { ok: false, error: "This suggestion has already been sent." };

  const { error } = await svc
    .from("prompt_suggestions")
    .update({
      status: "requested",
      requested_by: claims.sub,
      requested_at: new Date().toISOString(),
      operator_note: parsed.data.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.suggestionId)
    .eq("tenant_id", claims.tenant_id);
  if (error) return { ok: false, error: "Could not send the request." };

  revalidatePath("/dashboard/voice/quality");
  return { ok: true, message: "Sent to FlowMo for review." };
}

/** Operator dismisses a draft they don't want. Draft → dismissed. */
export async function dismissPromptSuggestion(input: { suggestionId: string }): Promise<PromptActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };
  if (claims.role === "Viewer") return { ok: false, error: "Owners and admins can dismiss a suggestion." };

  const parsed = z.object({ suggestionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await svc
    .from("prompt_suggestions")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.suggestionId)
    .eq("tenant_id", claims.tenant_id)
    .eq("status", "draft");
  if (error) return { ok: false, error: "Could not dismiss." };

  revalidatePath("/dashboard/voice/quality");
  return { ok: true };
}
