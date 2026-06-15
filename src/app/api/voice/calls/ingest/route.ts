import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseIngestBody } from "@/lib/voice/ingest-schema";
import { maybeNotifyUsage } from "@/lib/voice/usage-notify";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const parsed = parseIngestBody(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const d = parsed.data;

  const db = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await db.rpc("record_voice_call", {
    p_provider_call_id: d.provider_call_id,
    p_tenant: d.tenant_id,
    p_automation: d.automation_id,
    p_caller: d.caller_number ?? null,
    p_agent_number: d.agent_number ?? null,
    p_started_at: d.started_at ?? null,
    p_ended_at: d.ended_at ?? null,
    p_duration_s: d.duration_s ?? null,
    p_outcome: d.outcome,
    p_summary: d.summary ?? null,
    p_success: d.success ?? null,
    p_pickup: d.pickup ?? null,
    p_destination: d.destination ?? null,
    p_quoted_fare: d.quoted_fare ?? null,
    p_vehicle_type: d.vehicle_type ?? null,
    p_booking_ref: d.booking_ref ?? null,
    p_airport_code: d.airport_code ?? null,
    p_sentiment: d.sentiment ?? null,
    p_caller_name: d.caller_name ?? null,
    p_abandon_reason: d.abandon_reason ?? null,
  });
  if (error) {
    console.error("record_voice_call failed", error);
    return NextResponse.json(
      { error: "Could not record the call." },
      { status: 500 },
    );
  }

  // Usage notifications (running-low / plan-exhausted) — best-effort, and only
  // for a freshly recorded call (never on idempotent retries). Failures here
  // must not affect the 200 the voice provider needs.
  const r = data as Record<string, unknown> | null;
  if (r && r.duplicate === false) {
    try {
      await maybeNotifyUsage({
        tenantId: d.tenant_id,
        used: Number(r.used ?? 0),
        allowance: Number(r.allowance ?? 0),
        creditBalance: Number(r.credit_balance ?? 0),
        creditSource: String(r.credit_source ?? "none"),
        periodStart: String(r.period_start ?? ""),
      });
    } catch (e) {
      console.error("usage notification failed", e);
    }
  }

  return NextResponse.json(data, { status: 200 });
}
