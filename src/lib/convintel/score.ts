export interface ConversationSignals {
  outcome: string | null;
  durationSec: number;
  messageCount: number;
  avgBotReplySec: number;
}

export type QaFlag = "abandoned" | "slow" | "long" | "no_resolution";

export interface QaResult {
  score: number; // 0–100
  flags: QaFlag[];
}

/**
 * Pure, deterministic QA score from conversation signals. No LLM. v1 heuristic:
 * start at 100, subtract penalties for poor outcome, slow replies and bloated
 * length; collect matching flags. (LLM sentiment/intent is a follow-up that
 * will enrich, not replace, this score.)
 */
export function scoreConversation(s: ConversationSignals): QaResult {
  let score = 100;
  const flags: QaFlag[] = [];

  const goodOutcomes = ["booked", "managed", "quoted"];
  if (s.outcome === "abandoned") { score -= 45; flags.push("abandoned"); }
  else if (!goodOutcomes.includes(s.outcome ?? "")) { score -= 20; flags.push("no_resolution"); }

  if (s.avgBotReplySec > 8) { score -= 15; flags.push("slow"); }
  if (s.avgBotReplySec > 20) { score -= 10; } // extra penalty, no second flag

  if (s.messageCount > 40) { score -= 10; flags.push("long"); }

  return { score: Math.max(0, Math.min(100, Math.round(score))), flags };
}
