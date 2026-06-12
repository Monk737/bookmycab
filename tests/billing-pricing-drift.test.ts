// tests/billing-pricing-drift.test.ts
// Guards that the GBP figures billing charges never drift from the GBP figures
// marketing advertises. If a price changes in one place, it must change in both.
import { describe, it, expect } from "vitest";
import {
  CHAT_TIERS,
  VOICE_TIERS,
  BUNDLE_CHAT_DISCOUNT_GBP as MKT_BUNDLE_DISCOUNT,
  bundleChatPriceGbp as mktBundleChatPriceGbp,
  type TierKey,
} from "@/lib/marketing/pricing";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  BUNDLE_CHAT_DISCOUNT_GBP,
  bundleChatPriceGbp,
} from "@/lib/billing/pricing";

describe("billing GBP figures match marketing canonical GBP", () => {
  it("chat price per tier", () => {
    for (const t of CHAT_TIERS) {
      expect(CHAT_PRICE_GBP[t.key as TierKey]).toBe(t.priceGbp);
    }
  });

  it("voice per tier", () => {
    for (const t of VOICE_TIERS) {
      expect(VOICE_PRICE_GBP[t.key as TierKey]).toBe(t.priceGbp);
    }
  });

  it("bundle chat discount + discounted chat price match marketing", () => {
    for (const tier of ["ignition", "in_motion", "full_throttle"] as TierKey[]) {
      expect(BUNDLE_CHAT_DISCOUNT_GBP[tier]).toBe(MKT_BUNDLE_DISCOUNT[tier]);
      expect(bundleChatPriceGbp(tier)).toBe(mktBundleChatPriceGbp(tier));
    }
  });
});
