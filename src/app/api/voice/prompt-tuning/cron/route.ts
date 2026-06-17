// src/app/api/voice/prompt-tuning/cron/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { detectAllPromptSuggestions, measureRevisions } from "@/lib/voice/prompt-tuning";

export const runtime = "nodejs";
// One LLM draft per tenant with a rising reason + a measure pass — give it room.
export const maxDuration = 300;

/**
 * Prompt-tuning sweep. Detects new prompt suggestions across all tenants (cluster
 * a rising failure reason → draft a revision) and measures applied revisions past
 * their dwell window (auto-rolling-back ones that worsened). Authenticated with
 * the same bearer as voice ingest; point a daily cron at it. Idempotent: detection
 * refreshes the open draft per agent+reason; measurement only runs once per
 * revision.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const detect = await detectAllPromptSuggestions();
    const measure = await measureRevisions();
    return NextResponse.json({ detect, measure });
  } catch (e) {
    console.error("prompt-tuning sweep failed", e);
    return NextResponse.json({ error: "Prompt-tuning sweep failed." }, { status: 500 });
  }
}
