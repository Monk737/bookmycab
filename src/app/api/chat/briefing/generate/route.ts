import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { bearerMatches, optionalTenantId } from "@/lib/voice/ingest-auth";
import { generateAllChatBriefings, generateChatBriefingForTenant } from "@/lib/chat/briefing";

export const runtime = "nodejs";
// One LLM call per active tenant — give the batch room on platforms that cap.
export const maxDuration = 300;

/**
 * Weekly AI Chat briefing generator. Computes a tenant's week of WhatsApp
 * Chatbot aggregates (conversations + bookings) and writes one LLM narrative
 * into chat_briefings. Authenticated with CHAT_INGEST_SECRET (the same bearer
 * the chat mirror uses); point a weekly cron (n8n Schedule Trigger) at it.
 *
 * Scope: POST `{ tenant_id }` to generate only that tenant (per-tenant cloned
 * cron). Omit the body to sweep every active tenant (single platform cron).
 * Idempotent: re-running in the same week upserts.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.CHAT_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const tenantId = await optionalTenantId(req);
    const summary = tenantId
      ? { tenant_id: tenantId, ...(await generateChatBriefingForTenant(tenantId)) }
      : await generateAllChatBriefings();
    return NextResponse.json(summary);
  } catch (e) {
    console.error("chat briefing sweep failed", e);
    return NextResponse.json({ error: "Briefing generation failed." }, { status: 500 });
  }
}
