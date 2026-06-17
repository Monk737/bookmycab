import { describe, it, expect } from "vitest";
import {
  CHAT_SUITE_PRICE_GBP,
  CHAT_SUITE_SETUP_GBP,
  VOICE_IGNITION_SPEC,
  DEFAULT_EXTRA_CALL_PRICE_GBP,
  resolveBasePlanPricing,
  commercialModelLabel,
  type PlanType,
} from "@/lib/billing/pricing";

describe("fixed base-plan constants", () => {
  it("chat suite £499 + £999 setup", () => {
    expect(CHAT_SUITE_PRICE_GBP).toBe(499);
    expect(CHAT_SUITE_SETUP_GBP).toBe(999);
  });
  it("voice ignition: 1000 calls, £1999, £999 setup, 1 agent", () => {
    expect(VOICE_IGNITION_SPEC).toEqual({
      callAllowance: 1000,
      priceGbp: 1999,
      setupGbp: 999,
      includedAgents: 1,
    });
  });
  it("default overage is £0.90", () => {
    expect(DEFAULT_EXTRA_CALL_PRICE_GBP).toBe(0.9);
  });
});

describe("resolveBasePlanPricing", () => {
  it("whatsapp_suite → chat only", () => {
    expect(resolveBasePlanPricing("whatsapp_suite")).toEqual({
      chatGbp: 499, voiceGbp: null, voiceAllowance: null, voiceAgents: null, setupGbp: 999,
    });
  });
  it("voice_ignition → voice only", () => {
    expect(resolveBasePlanPricing("voice_ignition")).toEqual({
      chatGbp: null, voiceGbp: 1999, voiceAllowance: 1000, voiceAgents: 1, setupGbp: 999,
    });
  });
  it("custom → null (resolved by custom-plan module)", () => {
    expect(resolveBasePlanPricing("custom" as PlanType)).toBeNull();
  });
});

describe("commercialModelLabel", () => {
  it("labels chat / voice / custom and legacy double_decker", () => {
    expect(commercialModelLabel("chat")).toBe("WhatsApp Booking Suite");
    expect(commercialModelLabel("voice")).toBe("AI Voice Booking");
    expect(commercialModelLabel("custom")).toBe("Custom plan");
    expect(commercialModelLabel("double_decker")).toBe("Double Decker (Chat + Voice)");
    expect(commercialModelLabel(null)).toBe("—");
  });
});
