import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseIngestBody } from "@/lib/voice/ingest-schema";

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
  });
  if (error) {
    console.error("record_voice_call failed", error);
    return NextResponse.json(
      { error: "Could not record the call." },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: 200 });
}
