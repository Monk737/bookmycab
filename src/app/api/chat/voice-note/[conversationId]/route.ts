import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

export const runtime = "nodejs";

/**
 * Returns a short-lived signed URL for a conversation's WhatsApp voice note so
 * the dashboard detail drawer can play it. The audio lives in the private
 * `chat-voice-notes` bucket. Tenant scoping is enforced by RLS: the cookie-authed
 * client can only read its own tenant's conversation row, so a path is only ever
 * signed for audio the caller is entitled to.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // RLS restricts this to the caller's own tenant.
  const { data: conv } = await supabase
    .from("conversations")
    .select("voice_note_path")
    .eq("id", conversationId)
    .maybeSingle();

  const path = (conv?.voice_note_path as string | null) ?? null;
  if (!path) {
    return NextResponse.json({ error: "No voice note." }, { status: 404 });
  }

  const admin = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: signed, error } = await admin.storage
    .from("chat-voice-notes")
    .createSignedUrl(path, 120);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign the voice note." }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl }, { status: 200 });
}
