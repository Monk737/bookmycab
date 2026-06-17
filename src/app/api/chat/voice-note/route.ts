import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";

export const runtime = "nodejs";

const BUCKET = "chat-voice-notes";
const MAX_BYTES = 16 * 1024 * 1024; // WhatsApp voice notes are well under this.

/** Sanitise a value into a safe storage path segment. */
function safeSeg(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

type Body = {
  tenant_id?: string;
  automation_id?: string;
  conversation_ref?: string;
  customer_handle?: string;
  audio_base64?: string;
  content_type?: string;
};

/**
 * Chat voice-note ingest. The WhatsApp Voice-Note sub-workflow downloads the
 * audio (it holds the WhatsApp token) and POSTs it here as base64 JSON,
 * authenticated with CHAT_INGEST_SECRET. We store the audio in the private
 * `chat-voice-notes` bucket and stamp its path onto the conversation via
 * record_chat_conversation (coalesces voice_note_path, ORs via_voice, never
 * downgrades the outcome) so the dashboard drawer can play it back on demand.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.CHAT_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const tenantId = (body.tenant_id ?? "").trim();
  const automationId = (body.automation_id ?? "").trim();
  const conversationRef = (body.conversation_ref ?? "").trim();
  const customerHandle = (body.customer_handle ?? "").trim();
  const b64 = body.audio_base64 ?? "";

  if (!tenantId || !automationId || !conversationRef) {
    return NextResponse.json({ error: "Missing tenant_id, automation_id or conversation_ref." }, { status: 400 });
  }
  if (!b64) {
    return NextResponse.json({ error: "Missing audio_base64." }, { status: 400 });
  }

  const buffer = Buffer.from(b64, "base64");
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty audio." }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "Audio too large." }, { status: 413 });
  }

  const contentType = (body.content_type ?? "audio/ogg").split(";")[0].trim() || "audio/ogg";
  const ext = contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : contentType.includes("wav") ? "wav" : contentType.includes("mp4") || contentType.includes("m4a") ? "m4a" : "ogg";
  const path = `${safeSeg(tenantId)}/${safeSeg(conversationRef)}-${Date.now()}.${ext}`;

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (upErr) {
    console.error("voice-note upload failed", upErr);
    return NextResponse.json({ error: "Could not store the voice note." }, { status: 500 });
  }

  const { error: rpcErr } = await db.rpc("record_chat_conversation", {
    p_tenant: tenantId,
    p_automation: automationId,
    p_conversation_ref: conversationRef,
    p_customer_handle: customerHandle || "unknown",
    p_outcome: "unknown",
    p_channel: "whatsapp",
    p_via_voice: true,
    p_voice_note_path: path,
  });
  if (rpcErr) {
    console.error("record_chat_conversation (voice note) failed", rpcErr);
    return NextResponse.json({ error: "Stored audio but could not link it.", path }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path }, { status: 200 });
}
