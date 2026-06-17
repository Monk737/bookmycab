// tests/prompt-tuning-detector.test.ts
import { describe, it, expect } from "vitest";
import { pickRisingReason } from "@/lib/voice/prompt-tuning";

describe("pickRisingReason", () => {
  const total = 50;
  it("returns null when nothing meets the minimum count", () => {
    expect(pickRisingReason({ "Goal not met": 2 }, {}, total, 3)).toBeNull();
  });

  it("prefers the reason with the largest rise vs the prior window", () => {
    const cur = { "Goal not met": 8, "Unusually long": 10 };
    const prev = { "Goal not met": 2, "Unusually long": 9 }; // +300% vs +11%
    const r = pickRisingReason(cur, prev, total, 3);
    expect(r?.reason).toBe("Goal not met");
    expect(r?.count).toBe(8);
    expect(r?.deltaPct).toBe(300);
    expect(r?.flaggedRate).toBeCloseTo(8 / 50, 5);
  });

  it("treats a brand-new reason (no prior) as rising when it clears the minimum", () => {
    const r = pickRisingReason({ "Repeated address confusion": 5 }, {}, total, 3);
    expect(r?.reason).toBe("Repeated address confusion");
    expect(r?.deltaPct).toBeNull();
  });

  it("ignores reasons that fell or held flat", () => {
    expect(pickRisingReason({ "Goal not met": 4 }, { "Goal not met": 9 }, total, 3)).toBeNull();
  });
});
