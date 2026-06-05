export type CopilotIntent = "revenue" | "bookings_count" | "top_destinations" | "abandonment" | "help";

/** Pure: classify a natural-language question into a known data intent (keyword rules). */
export function classifyQuestion(text: string): CopilotIntent {
  const q = text.toLowerCase();
  if (/(revenue|earning|income|turnover|how much.*(made|make|money))/.test(q)) return "revenue";
  if (/(how many|number of|count).*(booking|ride|job|trip)|booking.*(count|total)/.test(q)) return "bookings_count";
  if (/(top|popular|common|most).*(destination|drop ?off|where)/.test(q)) return "top_destinations";
  if (/(abandon|drop ?off|drop ?out|give up|not finish|incomplete)/.test(q)) return "abandonment";
  return "help";
}

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Pure: turn an intent + its fetched data into a natural-language answer. */
export function formatAnswer(intent: CopilotIntent, data: Record<string, unknown>): string {
  switch (intent) {
    case "revenue": {
      const total = Number(data.total ?? 0);
      const completed = Number(data.completed ?? 0);
      return `Over the last 30 days you took ${gbp(total)} across ${completed} completed journeys.`;
    }
    case "bookings_count": {
      return `You've had ${Number(data.total ?? 0)} bookings in the last 30 days.`;
    }
    case "top_destinations": {
      const items = Array.isArray(data.items) ? (data.items as { name: string; value: number }[]) : [];
      if (items.length === 0) return "I couldn't find any destination data for the last 30 days.";
      return `Your top destinations (last 30 days): ${items.map((i) => `${i.name} (${i.value})`).join(", ")}.`;
    }
    case "abandonment": {
      const rate = Number(data.rate ?? 0);
      return `Your abandonment rate over the last 30 days is ${rate}%. ${rate > 15 ? "That's on the high side — consider reviewing the booking prompts." : "That's within a healthy range."}`;
    }
    case "help":
    default:
      return "I can answer questions about your data — try: \"How much revenue this month?\", \"How many bookings last week?\", \"What are my top destinations?\", or \"Why are customers abandoning?\".";
  }
}

/** Pure: rough token estimate (~1 token / 4 chars), minimum 1. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
