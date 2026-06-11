// tests/billing-new-model.test.ts
import { describe, it, expect } from "vitest";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  DOUBLE_DECKER_GBP,
  NEW_CHAT_SETUP_GBP,
  NEW_VOICE_SETUP_GBP,
  NEW_BUNDLE_SETUP_GBP,
  chatMonthlyPriceGbp,
  voiceMonthlyPriceGbp,
  type NewTierKey,
  type ChatChannelMode,
} from "@/lib/billing/pricing";

describe("new-model GBP figures", () => {
  it("chat prices", () => {
    expect(CHAT_PRICE_GBP.ignition.single).toBe(499);
    expect(CHAT_PRICE_GBP.ignition.bundle).toBe(899);
    expect(CHAT_PRICE_GBP.in_motion.single).toBe(999);
    expect(CHAT_PRICE_GBP.in_motion.bundle).toBe(1799);
    expect(CHAT_PRICE_GBP.full_throttle.single).toBeNull();
    expect(CHAT_PRICE_GBP.full_throttle.bundle).toBeNull();
  });
  it("voice prices", () => {
    expect(VOICE_PRICE_GBP.ignition).toBe(1199);
    expect(VOICE_PRICE_GBP.in_motion).toBe(1599);
    expect(VOICE_PRICE_GBP.full_throttle).toBe(1999);
  });
  it("setup fees", () => {
    expect(NEW_CHAT_SETUP_GBP).toBe(1000);
    expect(NEW_VOICE_SETUP_GBP).toEqual({ oneAgent: 1000, twoAgents: 1500, secondAgentAddOn: 500 });
    expect(NEW_BUNDLE_SETUP_GBP).toEqual({ oneVoiceAgent: 1500, twoVoiceAgents: 2000 });
  });
});

describe("Double Decker split sums to the advertised total", () => {
  const tiers: NewTierKey[] = ["ignition", "in_motion", "full_throttle"];
  const modes: ChatChannelMode[] = ["single", "bundle"];
  for (const tier of tiers) {
    for (const mode of modes) {
      it(`${tier}/${mode}: chat + voice === total`, () => {
        const s = DOUBLE_DECKER_GBP[tier][mode];
        expect(s.chat + s.voice).toBe(s.total);
      });
    }
  }
  it("matches the spec totals", () => {
    expect(DOUBLE_DECKER_GBP.ignition.single.total).toBe(1599);
    expect(DOUBLE_DECKER_GBP.ignition.bundle.total).toBe(1999);
    expect(DOUBLE_DECKER_GBP.in_motion.single.total).toBe(2499);
    expect(DOUBLE_DECKER_GBP.in_motion.bundle.total).toBe(3199);
    expect(DOUBLE_DECKER_GBP.full_throttle.single.total).toBe(2999);
    expect(DOUBLE_DECKER_GBP.full_throttle.bundle.total).toBe(3799);
  });
});

describe("price-resolution helpers", () => {
  it("chat-only tenant: chat price from standalone, no voice charge", () => {
    expect(chatMonthlyPriceGbp("chat", "in_motion", "bundle")).toBe(1799);
    expect(voiceMonthlyPriceGbp("chat", "in_motion", "bundle")).toBeNull();
  });
  it("voice-only tenant: voice price from standalone, no chat charge", () => {
    expect(voiceMonthlyPriceGbp("voice", "in_motion", "single")).toBe(1599);
    expect(chatMonthlyPriceGbp("voice", "in_motion", "single")).toBeNull();
  });
  it("double_decker tenant: both from the authored split", () => {
    expect(chatMonthlyPriceGbp("double_decker", "in_motion", "bundle")).toBe(1600);
    expect(voiceMonthlyPriceGbp("double_decker", "in_motion", "bundle")).toBe(1599);
  });
});
