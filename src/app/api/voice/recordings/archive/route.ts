import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { archiveRecording } from "@/lib/voice/archive-recording";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 5;
const BATCH = 20;

/**
 * Archive sweep: copies any call recordings that the ingest path's after() hook
 * missed (function froze, download/upload failed) into our Storage bucket. Safe
 * to run on a schedule — idempotent and retry-capped. Authenticated with the same
 * bearer as the ingest endpoint; point a cron (Vercel cron / external scheduler)
 * at it every few minutes.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await db
    .from("call_artifacts")
    .select("call_id, tenant_id, source_url, attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .not("source_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("archive sweep query failed", error);
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  let archived = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    // Claim the row by bumping attempts first, so a retry is always counted even
    // if the process dies mid-archive.
    await db
      .from("call_artifacts")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("call_id", row.call_id);
    const ok = await archiveRecording(row.call_id, row.tenant_id, row.source_url as string);
    if (ok) archived++;
    else failed++;
  }

  return NextResponse.json({ scanned: (rows ?? []).length, archived, failed });
}
