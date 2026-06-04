// tests/convintel-score.test.ts
import { describe, it, expect } from "vitest";
import { scoreConversation, type ConversationSignals } from "@/lib/convintel/score";

const base: ConversationSignals = {
  outcome: "booked",
  durationSec: 120,
  messageCount: 14,
  avgBotReplySec: 3,
};

describe("scoreConversation", () => {
  it("a fast successful booking scores high with no flags", () => {
    const r = scoreConversation(base);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.flags).toHaveLength(0);
  });
  it("an abandoned conversation is penalised + flagged", () => {
    const r = scoreConversation({ ...base, outcome: "abandoned" });
    expect(r.score).toBeLessThan(60);
    expect(r.flags).toContain("abandoned");
  });
  it("slow bot replies add a 'slow' flag and reduce score", () => {
    const fast = scoreConversation(base).score;
    const slow = scoreConversation({ ...base, avgBotReplySec: 20 });
    expect(slow.flags).toContain("slow");
    expect(slow.score).toBeLessThan(fast);
  });
  it("a very long conversation (many turns) flags 'long'", () => {
    const r = scoreConversation({ ...base, messageCount: 60 });
    expect(r.flags).toContain("long");
  });
  it("clamps the score to the 0–100 range", () => {
    const r = scoreConversation({ outcome: "abandoned", durationSec: 9999, messageCount: 200, avgBotReplySec: 99 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
