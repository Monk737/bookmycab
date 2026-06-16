import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { generateAllBriefings } from "@/lib/voice/briefing";

export const runtime = "nodejs";
// One Claude call per active tenant — give the batch room on platforms that cap.
export const maxDuration = 300;

/**
 * Weekly AI briefing generator. Computes each active tenant's week of voice
 * aggregates and writes one LLM narrative per tenant into voice_briefings.
 * Authenticated with the same bearer as ingest; point a weekly cron (n8n
 * Schedule Trigger) at it. Idempotent: re-running in the same week upserts.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const summary = await generateAllBriefings();
    return NextResponse.json(summary);
  } catch (e) {
    console.error("briefing sweep failed", e);
    return NextResponse.json({ error: "Briefing generation failed." }, { status: 500 });
  }
}
