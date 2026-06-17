// tests/billing-pricing-drift.test.ts
// Guards that the GBP figures billing charges never drift from the GBP figures
// marketing advertises for the two FIXED plans.
import { describe, it, expect } from "vitest";
import { CHAT_SUITE, VOICE_IGNITION, EXTRA_CALL_PRICE_GBP } from "@/lib/marketing/pricing";
import {
  CHAT_SUITE_PRICE_GBP,
  CHAT_SUITE_SETUP_GBP,
  VOICE_IGNITION_SPEC,
  DEFAULT_EXTRA_CALL_PRICE_GBP,
} from "@/lib/billing/pricing";
import { CREDIT_UNIT_GBP } from "@/lib/billing/credit";

describe("billing GBP matches marketing canonical GBP", () => {
  it("WhatsApp Suite price + setup", () => {
    expect(CHAT_SUITE_PRICE_GBP).toBe(CHAT_SUITE.priceGbp);
    expect(CHAT_SUITE_SETUP_GBP).toBe(CHAT_SUITE.setupGbp);
  });
  it("Voice Ignition price + calls + setup", () => {
    expect(VOICE_IGNITION_SPEC.priceGbp).toBe(VOICE_IGNITION.priceGbp);
    expect(VOICE_IGNITION_SPEC.callAllowance).toBe(VOICE_IGNITION.callsPerMonth);
    expect(VOICE_IGNITION_SPEC.setupGbp).toBe(VOICE_IGNITION.setupGbp);
  });
  it("base credit rate matches across marketing + billing + ledger", () => {
    expect(DEFAULT_EXTRA_CALL_PRICE_GBP).toBe(EXTRA_CALL_PRICE_GBP);
    expect(CREDIT_UNIT_GBP).toBe(EXTRA_CALL_PRICE_GBP);
  });
});
