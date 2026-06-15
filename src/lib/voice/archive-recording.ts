import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";

/** Private Storage bucket holding our durable copies of call recordings. */
export const RECORDINGS_BUCKET = "call-recordings";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_BYTES = 50 * 1024 * 1024; // 50MB — a long call is a few MB; this is a sanity cap.

function serviceClient() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

function extFor(contentType: string | null): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3";
  if (ct.includes("ogg") || ct.includes("opus")) return "ogg";
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac")) return "m4a";
  if (ct.includes("webm")) return "webm";
  return "wav"; // Vapi's default mono recording is WAV.
}

/**
 * Copy a call's provider recording into our own Storage bucket and record the
 * durable path on call_artifacts.
 *
 * Best-effort and idempotent: safe to retry (upload upserts; the row update is
 * by primary key), and any failure is captured on the row (status='failed',
 * error) rather than thrown — callers in the request path must never break a
 * recorded call because an audio copy failed. Returns true only when archived.
 */
export async function archiveRecording(
  callId: string,
  tenantId: string,
  sourceUrl: string,
): Promise<boolean> {
  const db = serviceClient();
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`source fetch ${res.status}`);

    const contentType = res.headers.get("content-type");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("empty recording");
    if (bytes.byteLength > MAX_BYTES) throw new Error(`recording too large (${bytes.byteLength} bytes)`);

    const path = `${tenantId}/${callId}.${extFor(contentType)}`;
    const { error: upErr } = await db.storage.from(RECORDINGS_BUCKET).upload(path, bytes, {
      contentType: contentType ?? "audio/wav",
      upsert: true,
    });
    if (upErr) throw upErr;

    const { error: rowErr } = await db
      .from("call_artifacts")
      .update({
        status: "archived",
        storage_path: path,
        bytes: bytes.byteLength,
        content_type: contentType,
        error: null,
      })
      .eq("call_id", callId);
    if (rowErr) throw rowErr;

    return true;
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 500);
    await db
      .from("call_artifacts")
      .update({ status: "failed", error: message })
      .eq("call_id", callId);
    console.error("archiveRecording failed", { callId, message });
    return false;
  }
}
