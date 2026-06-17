import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { bearerMatches, optionalTenantId } from "@/lib/voice/ingest-auth";
import { generateAllBriefings, generateBriefingForTenant } from "@/lib/voice/briefing";

export const runtime = "nodejs";
// One Claude call per active tenant — give the batch room on platforms that cap.
export const maxDuration = 300;

/**
 * Weekly AI briefing generator. Computes a tenant's week of voice aggregates and
 * writes one LLM narrative into voice_briefings. Authenticated with the same
 * bearer as ingest; point a weekly cron (n8n Schedule Trigger) at it.
 *
 * Scope: POST `{ tenant_id }` to generate only that tenant (per-tenant cloned
 * cron). Omit the body to sweep every active tenant (single platform cron).
 * Idempotent: re-running in the same week upserts.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const tenantId = await optionalTenantId(req);
    const summary = tenantId
      ? { tenant_id: tenantId, ...(await generateBriefingForTenant(tenantId)) }
      : await generateAllBriefings();
    return NextResponse.json(summary);
  } catch (e) {
    console.error("briefing sweep failed", e);
    return NextResponse.json({ error: "Briefing generation failed." }, { status: 500 });
  }
}
