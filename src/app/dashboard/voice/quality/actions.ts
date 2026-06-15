"use server";

import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

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

  return {
    ok: true,
    transcript: data.transcript ?? null,
    recordingUrl: data.recording_url ?? null,
    startedAt: data.started_at ?? null,
    caller: data.caller_number ?? null,
    callerName: data.caller_name ?? null,
    outcome: data.outcome ?? null,
    durationS: data.duration_s ?? null,
    summary: data.summary ?? null,
  };
}
