// tests/billing-pricing-drift.test.ts
// Guards that the GBP figures billing charges never drift from the GBP figures
// marketing advertises. If a price changes in one place, it must change in both.
import { describe, it, expect } from "vitest";
import {
  CHAT_TIERS,
  VOICE_TIERS,
  BUNDLE_TIERS,
  type TierKey,
} from "@/lib/marketing/pricing";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  DOUBLE_DECKER_GBP,
} from "@/lib/billing/pricing";

describe("billing GBP figures match marketing canonical GBP", () => {
  it("chat single/bundle per tier", () => {
    for (const t of CHAT_TIERS) {
      const key = t.key as TierKey;
      expect(CHAT_PRICE_GBP[key].single).toBe(t.singleGbp);
      expect(CHAT_PRICE_GBP[key].bundle).toBe(t.bundleGbp);
    }
  });

  it("voice per tier", () => {
    for (const t of VOICE_TIERS) {
      expect(VOICE_PRICE_GBP[t.key as TierKey]).toBe(t.priceGbp);
    }
  });

  it("double decker single/bundle totals", () => {
    for (const t of BUNDLE_TIERS) {
      const key = t.key as TierKey;
      expect(DOUBLE_DECKER_GBP[key].single.total).toBe(t.single.priceGbp);
      expect(DOUBLE_DECKER_GBP[key].bundle.total).toBe(t.bundle.priceGbp);
    }
  });
});
