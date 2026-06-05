import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { classifyQuestion, formatAnswer, estimateTokens, type CopilotIntent } from "./classify";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CopilotTurn { id: string; question: string; answer: string; intent: string | null; created_at: string }

const SINCE = () => new Date(Date.now() - 30 * 86400_000).toISOString();

/** Fetch the data needed to answer a given intent for a tenant (last 30 days). */
async function fetchData(tenantId: string, intent: CopilotIntent): Promise<Record<string, unknown>> {
  const sb = svc();
  if (intent === "revenue") {
    const { data } = await sb.from("bookings").select("fare, status").eq("tenant_id", tenantId).gte("created_at", SINCE());
    const rows = data ?? [];
    return { total: rows.reduce((s, r) => s + (Number(r.fare) || 0), 0), completed: rows.filter((r) => r.status === "completed").length };
  }
  if (intent === "bookings_count") {
    const { count } = await sb.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", SINCE());
    return { total: count ?? 0 };
  }
  if (intent === "top_destinations") {
    const { data } = await sb.from("bookings").select("destination_address").eq("tenant_id", tenantId).gte("created_at", SINCE());
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      const dest = (r.destination_address as { formatted?: string; name?: string } | null);
      const name = dest?.name ?? dest?.formatted;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const items = [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    return { items };
  }
  if (intent === "abandonment") {
    const { data } = await sb.from("conversations").select("outcome").eq("tenant_id", tenantId).gte("started_at", SINCE());
    const rows = data ?? [];
    const rate = rows.length === 0 ? 0 : +((rows.filter((r) => r.outcome === "abandoned").length / rows.length) * 100).toFixed(1);
    return { rate };
  }
  return {};
}

/**
 * Answer a question: classify → fetch data → format → log the exchange → meter.
 * v1 is deterministic (no LLM). A future LLM path slots in here, using the
 * tenant's own AI key, and would set richer tokens/cost.
 */
export async function askCopilot(tenantId: string, userId: string, question: string): Promise<{ answer: string; intent: CopilotIntent }> {
  const intent = classifyQuestion(question);
  const data = await fetchData(tenantId, intent);
  const answer = formatAnswer(intent, data);
  const tokens = estimateTokens(question) + estimateTokens(answer);
  await svc().from("copilot_messages").insert({ tenant_id: tenantId, user_id: userId, question, answer, intent, tokens });
  await recordUsage({ tenantId, featureKey: "ai_copilot", quantity: tokens, unit: "tokens" });
  return { answer, intent };
}

export async function listHistory(tenantId: string, limit = 30): Promise<CopilotTurn[]> {
  const { data } = await svc().from("copilot_messages").select("id, question, answer, intent, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as CopilotTurn[];
}
