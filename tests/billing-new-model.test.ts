// tests/billing-new-model.test.ts
import { describe, it, expect } from "vitest";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  BUNDLE_CHAT_DISCOUNT_GBP,
  bundleChatPriceGbp,
  NEW_CHAT_SETUP_GBP,
  NEW_VOICE_SETUP_GBP,
  NEW_BUNDLE_SETUP_GBP,
  chatMonthlyPriceGbp,
  voiceMonthlyPriceGbp,
} from "@/lib/billing/pricing";

describe("new-model GBP figures", () => {
  it("chat prices (single value per tier)", () => {
    expect(CHAT_PRICE_GBP.ignition).toBe(599);
    expect(CHAT_PRICE_GBP.in_motion).toBe(999);
    expect(CHAT_PRICE_GBP.full_throttle).toBe(1299);
  });
  it("voice prices", () => {
    expect(VOICE_PRICE_GBP.ignition).toBe(1299);
    expect(VOICE_PRICE_GBP.in_motion).toBe(1799);
    expect(VOICE_PRICE_GBP.full_throttle).toBe(2199);
  });
  it("setup fees", () => {
    expect(NEW_CHAT_SETUP_GBP).toBe(1000);
    expect(NEW_VOICE_SETUP_GBP).toEqual({ oneAgent: 1000, twoAgents: 1500, secondAgentAddOn: 500 });
    expect(NEW_BUNDLE_SETUP_GBP).toEqual({ oneVoiceAgent: 1500, twoVoiceAgents: 2000 });
  });
});

describe("Double Decker (Mix & Match) chat discount", () => {
  it("discount per tier", () => {
    expect(BUNDLE_CHAT_DISCOUNT_GBP).toEqual({ ignition: 100, in_motion: 200, full_throttle: 300 });
  });
  it("discounted chat price = list − discount", () => {
    expect(bundleChatPriceGbp("ignition")).toBe(499);
    expect(bundleChatPriceGbp("in_motion")).toBe(799);
    expect(bundleChatPriceGbp("full_throttle")).toBe(999);
  });
});

describe("price-resolution helpers", () => {
  it("chat-only tenant: chat list price, no voice charge", () => {
    expect(chatMonthlyPriceGbp("chat", "in_motion")).toBe(999);
    expect(voiceMonthlyPriceGbp("chat", "in_motion")).toBeNull();
  });
  it("voice-only tenant: voice list price, no chat charge", () => {
    expect(voiceMonthlyPriceGbp("voice", "in_motion")).toBe(1799);
    expect(chatMonthlyPriceGbp("voice", "in_motion")).toBeNull();
  });
  it("double_decker: voice full price + discounted chat", () => {
    expect(chatMonthlyPriceGbp("double_decker", "in_motion")).toBe(799); // 999 − 200
    expect(voiceMonthlyPriceGbp("double_decker", "in_motion")).toBe(1799); // unchanged
  });
});
