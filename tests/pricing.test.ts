import { describe, it, expect } from "vitest";
import {
  CHAT_SUITE,
  VOICE_IGNITION,
  EXTRA_CALL_PRICE_GBP,
  formatPrice,
  priceFor,
  CURRENCIES,
  BASE_CURRENCY,
} from "@/lib/marketing/pricing";

const RATES = { GBP: 1, EUR: 1.18, USD: 1.27 };

describe("fixed plan constants", () => {
  it("WhatsApp Booking Suite is £499/mo + £999 setup", () => {
    expect(CHAT_SUITE.priceGbp).toBe(499);
    expect(CHAT_SUITE.setupGbp).toBe(999);
    expect(CHAT_SUITE.name).toBe("WhatsApp Booking Suite");
  });
  it("AI Voice Ignition is 1000 calls, £1999/mo + £999 setup", () => {
    expect(VOICE_IGNITION.callsPerMonth).toBe(1000);
    expect(VOICE_IGNITION.priceGbp).toBe(1999);
    expect(VOICE_IGNITION.setupGbp).toBe(999);
    expect(VOICE_IGNITION.name).toBe("Ignition");
  });
  it("base extra-call credit is £2", () => {
    expect(EXTRA_CALL_PRICE_GBP).toBe(2);
  });
});

describe("format / convert helpers (unchanged)", () => {
  it("BASE_CURRENCY is GBP and CURRENCIES has 3", () => {
    expect(BASE_CURRENCY).toBe("GBP");
    expect(CURRENCIES).toHaveLength(3);
  });
  it("formats GBP whole pounds", () => {
    expect(formatPrice("GBP", 1999)).toBe("£1,999");
  });
  it("converts + formats EUR", () => {
    expect(priceFor(499, "EUR", RATES)).toBe("€589");
  });
  it("never renders NaN", () => {
    expect(formatPrice("GBP", Number.NaN)).toBe("£0");
  });
});
