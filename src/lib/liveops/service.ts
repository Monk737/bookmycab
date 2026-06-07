import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { nextTakeoverState, type TakeoverStatus, type TakeoverAction } from "./takeover";
import { relayToChannel } from "./relay";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ActiveConversation {
  id: string; customer_handle: string; customer_name: string | null; takeover_status: string;
  assigned_to: string | null; started_at: string; last_human_reply_at: string | null; automation_id: string;
}

/** Conversations that are open (not ended), the live-ops queue. */
export async function listActiveConversations(tenantId: string): Promise<ActiveConversation[]> {
  const { data } = await svc()
    .from("conversations")
    .select("id, customer_handle, customer_name, takeover_status, assigned_to, started_at, last_human_reply_at, automation_id")
    .eq("tenant_id", tenantId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ActiveConversation[];
}

async function applyTransition(tenantId: string, conversationId: string, action: TakeoverAction, userId: string | null): Promise<{ ok: boolean; status?: TakeoverStatus }> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("takeover_status").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (!conv) return { ok: false };
  const current = (conv.takeover_status as TakeoverStatus) ?? "bot";
  const next = nextTakeoverState(current, action);
  const patch: Record<string, unknown> = { takeover_status: next };
  if (action === "claim") { patch.assigned_to = userId; patch.takeover_at = new Date().toISOString(); }
  if (action === "release") { patch.assigned_to = null; }
  await sb.from("conversations").update(patch).eq("tenant_id", tenantId).eq("id", conversationId);
  return { ok: true, status: next };
}

export async function claimConversation(tenantId: string, conversationId: string, userId: string) {
  return applyTransition(tenantId, conversationId, "claim", userId);
}
export async function releaseConversation(tenantId: string, conversationId: string) {
  return applyTransition(tenantId, conversationId, "release", null);
}

export interface ThreadMessage { id: string; direction: string; source: string; payload: unknown; transcript: string | null; ts: string }

export async function getThread(tenantId: string, conversationId: string): Promise<ThreadMessage[]> {
  const sb = svc();
  // Confirm the conversation belongs to the tenant before returning its messages.
  const { data: conv } = await sb.from("conversations").select("id").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (!conv) return [];
  const { data } = await sb.from("messages").select("id, direction, source, payload, transcript, ts").eq("conversation_id", conversationId).order("ts");
  return (data ?? []) as ThreadMessage[];
}

/**
 * Post a staff reply: only allowed when the conversation is in `human` takeover.
 * Writes a source='human' outbound message, stamps last_human_reply_at, and
 * relays the text to the channel. Returns relay outcome.
 */
export async function postStaffMessage(args: { tenantId: string; conversationId: string; userId: string; text: string }): Promise<{ ok: boolean; relayed: boolean; reason?: string }> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("takeover_status, automation_id, customer_handle").eq("tenant_id", args.tenantId).eq("id", args.conversationId).maybeSingle();
  if (!conv) return { ok: false, relayed: false, reason: "not_found" };
  if (conv.takeover_status !== "human") return { ok: false, relayed: false, reason: "not_in_takeover" };

  const now = new Date().toISOString();
  await sb.from("messages").insert({
    conversation_id: args.conversationId,
    direction: "outbound",
    message_type: "text",
    payload: { text: args.text },
    source: "human",
    sent_by_user_id: args.userId,
    ts: now,
  });
  await sb.from("conversations").update({ last_human_reply_at: now }).eq("tenant_id", args.tenantId).eq("id", args.conversationId);

  const relayed = await relayToChannel({
    automationId: conv.automation_id as string,
    conversationId: args.conversationId,
    customerHandle: conv.customer_handle as string,
    text: args.text,
  });
  return { ok: true, relayed };
}
