import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseChatConversationBody } from "@/lib/chat/ingest-schema";

export const runtime = "nodejs";

/**
 * Chat conversation mirror endpoint. The WhatsApp Chatbot (Chat + Voice Note)
 * n8n workflow calls this on each journey state change (open / quoted / booked /
 * managed / cancelled), authenticated with CHAT_INGEST_SECRET. Writes go through
 * the record_chat_conversation upsert RPC (service role), keyed on
 * (tenant_id, conversation_ref), so the Chat dashboard numbers are exactly what
 * the workflow reported. No call/credit logic — a voice note is not a phone call.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.CHAT_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const parsed = parseChatConversationBody(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const d = parsed.data;

  const db = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await db.rpc("record_chat_conversation", {
    p_tenant: d.tenant_id,
    p_automation: d.automation_id,
    p_conversation_ref: d.conversation_ref,
    p_customer_handle: d.customer_handle,
    p_outcome: d.outcome,
    p_channel: d.channel,
    p_customer_name: d.customer_name ?? null,
    p_started_at: d.started_at ?? null,
    p_via_voice: d.via_voice ?? false,
    p_language: d.language ?? "en",
    p_summary: d.summary ?? null,
    p_voice_note_path: d.voice_note_path ?? null,
  });
  if (error) {
    console.error("record_chat_conversation failed", error);
    return NextResponse.json(
      { error: "Could not record the conversation." },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 200 });
}
