import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { scoreConversation, type ConversationSignals } from "./score";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ScoredConversation {
  id: string; customer_handle: string; customer_name: string | null; outcome: string | null;
  qa_score: number | null; qa_flags: unknown; flagged_for_review: boolean; started_at: string;
}

/** Compute + persist a QA score for one conversation from its messages. */
export async function analyzeConversation(tenantId: string, conversationId: string): Promise<{ ok: boolean }> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("outcome, started_at, ended_at").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (!conv) return { ok: false };
  const { data: msgs } = await sb.from("messages").select("direction, ts").eq("conversation_id", conversationId).order("ts");
  const messages = msgs ?? [];

  const durationSec = conv.ended_at && conv.started_at
    ? Math.max(0, (Date.parse(conv.ended_at as string) - Date.parse(conv.started_at as string)) / 1000)
    : 0;

  // average bot reply latency = mean gap from an inbound message to the next outbound
  let gaps = 0, count = 0;
  for (let i = 1; i < messages.length; i++) {
    if (messages[i - 1].direction === "inbound" && messages[i].direction === "outbound") {
      gaps += (Date.parse(messages[i].ts as string) - Date.parse(messages[i - 1].ts as string)) / 1000;
      count++;
    }
  }
  const avgBotReplySec = count > 0 ? gaps / count : 0;

  const signals: ConversationSignals = { outcome: (conv.outcome as string) ?? null, durationSec, messageCount: messages.length, avgBotReplySec };
  const { score, flags } = scoreConversation(signals);
  await sb.from("conversations").update({ qa_score: score, qa_flags: flags }).eq("tenant_id", tenantId).eq("id", conversationId);
  return { ok: true };
}

/** Score the most recent un-scored conversations (bounded). Returns count scored. */
export async function analyzeRecent(tenantId: string, limit = 50): Promise<{ scored: number }> {
  const sb = svc();
  const { data } = await sb.from("conversations").select("id").eq("tenant_id", tenantId).is("qa_score", null).order("started_at", { ascending: false }).limit(limit);
  let scored = 0;
  for (const c of data ?? []) {
    const r = await analyzeConversation(tenantId, c.id as string);
    if (r.ok) scored++;
  }
  return { scored };
}

/** Full-text-ish search over message text/transcripts, returns matching conversations. */
export async function searchConversations(tenantId: string, q: string, limit = 30): Promise<ScoredConversation[]> {
  const sb = svc();
  const term = q.trim();
  if (!term) return [];
  const safe = term.replace(/[(),%*]/g, " ").trim();
  if (!safe) return [];
  // Find conversation ids whose messages contain the term (text payload or transcript).
  const { data: msgHits } = await sb
    .from("messages")
    .select("conversation_id, payload, transcript")
    .or(`transcript.ilike.%${safe}%,payload->>text.ilike.%${safe}%`)
    .limit(500);
  const convIds = [...new Set((msgHits ?? []).map((m) => m.conversation_id as string))];
  if (convIds.length === 0) return [];
  const { data } = await sb
    .from("conversations")
    .select("id, customer_handle, customer_name, outcome, qa_score, qa_flags, flagged_for_review, started_at")
    .eq("tenant_id", tenantId)
    .in("id", convIds)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ScoredConversation[];
}

export async function listFlagged(tenantId: string, limit = 50): Promise<ScoredConversation[]> {
  const { data } = await svc()
    .from("conversations")
    .select("id, customer_handle, customer_name, outcome, qa_score, qa_flags, flagged_for_review, started_at")
    .eq("tenant_id", tenantId)
    .eq("flagged_for_review", true)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ScoredConversation[];
}

export async function flagForReview(tenantId: string, conversationId: string, flagged: boolean): Promise<void> {
  await svc().from("conversations").update({ flagged_for_review: flagged }).eq("tenant_id", tenantId).eq("id", conversationId);
}

export async function submitReview(args: { tenantId: string; conversationId: string; reviewerId: string; rating?: number; label?: string; note?: string }): Promise<void> {
  await svc().from("conversation_reviews").insert({
    tenant_id: args.tenantId, conversation_id: args.conversationId, reviewer_id: args.reviewerId,
    rating: args.rating ?? null, label: args.label ?? null, note: args.note ?? null,
  });
}
