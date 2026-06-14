import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface VoiceCallLogRow {
  id: string;
  agentName: string;
  caller: string | null;
  startedAt: string;
  durationS: number | null;
  outcome: string;
  creditSource: string;
  summary: string | null;
  success: boolean | null;
}

/**
 * Full voice call log for a tenant over the last `days`, newest first. RLS-scoped
 * through the server client. Unlike the capped `recent` list in getVoiceAnalytics,
 * this returns the whole window so the dashboard can filter by date.
 */
export async function getVoiceCallLog(
  tenantId: string,
  days = 90,
): Promise<VoiceCallLogRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: calls }, { data: agents }] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, automation_id, caller_number, started_at, duration_s, outcome, credit_source, summary, success",
      )
      .eq("tenant_id", tenantId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1000),
    supabase
      .from("voice_agents")
      .select("automation_id, display_name")
      .eq("tenant_id", tenantId),
  ]);

  const nameByAutomation = new Map<string, string>(
    ((agents ?? []) as { automation_id: string; display_name: string }[]).map((a) => [
      a.automation_id,
      a.display_name,
    ]),
  );

  type Row = {
    id: string;
    automation_id: string;
    caller_number: string | null;
    started_at: string;
    duration_s: number | null;
    outcome: string;
    credit_source: string;
    summary: string | null;
    success: boolean | null;
  };

  return ((calls ?? []) as Row[]).map((c) => ({
    id: c.id,
    agentName: nameByAutomation.get(c.automation_id) ?? "Voice agent",
    caller: c.caller_number ?? null,
    startedAt: c.started_at,
    durationS: c.duration_s ?? null,
    outcome: c.outcome,
    creditSource: c.credit_source,
    summary: c.summary ?? null,
    success: c.success ?? null,
  }));
}
