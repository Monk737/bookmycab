/**
 * Tests for src/lib/marketing/pricing.ts
 *
 * GBP is the source of truth. EUR/USD are derived at display time from live FX
 * rates (see fx.ts), so this file tests GBP data + the convert/format helpers.
 */
import { describe, it, expect } from "vitest";
import {
  CHAT_TIERS,
  CHAT_SETUP_FEE_GBP,
  VOICE_TIERS,
  VOICE_SETUP_GBP,
  BUNDLE_TIERS,
  BUNDLE_SETUP_GBP,
  EXTRA_CALL_PRICE_GBP,
  CURRENCIES,
  BASE_CURRENCY,
  convert,
  formatPrice,
  priceFor,
} from "@/lib/marketing/pricing";

const RATES = { GBP: 1, EUR: 1.18, USD: 1.27 } as const;

describe("Chat tiers", () => {
  it("has Ignition / In Motion / Full Throttle in order", () => {
    expect(CHAT_TIERS.map((t) => t.key)).toEqual([
      "ignition",
      "in_motion",
      "full_throttle",
    ]);
  });
  it("Ignition: £499 single / £899 bundle / max 2 channels / ≤50 fleet", () => {
    const t = CHAT_TIERS[0];
    expect(t.singleGbp).toBe(499);
    expect(t.bundleGbp).toBe(899);
    expect(t.bundleMaxChannels).toBe(2);
    expect(t.contactOnly).toBe(false);
    expect(t.fleet).toContain("50");
  });
  it("In Motion: £999 single / £1799 bundle / 51–100 fleet / featured", () => {
    const t = CHAT_TIERS[1];
    expect(t.singleGbp).toBe(999);
    expect(t.bundleGbp).toBe(1799);
    expect(t.bundleMaxChannels).toBe(2);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: contact only, no fixed price", () => {
    const t = CHAT_TIERS[2];
    expect(t.contactOnly).toBe(true);
    expect(t.singleGbp).toBeNull();
    expect(t.bundleGbp).toBeNull();
  });
  it("Chat setup fee is £1000", () => {
    expect(CHAT_SETUP_FEE_GBP).toBe(1000);
  });
});

describe("Voice tiers", () => {
  it("Ignition: 1500 calls / £1199 / 1 number 1 agent", () => {
    const t = VOICE_TIERS[0];
    expect(t.callsPerMonth).toBe(1500);
    expect(t.priceGbp).toBe(1199);
    expect(t.config).toMatch(/1 number/i);
  });
  it("In Motion: 2250 calls / £1599 / featured", () => {
    const t = VOICE_TIERS[1];
    expect(t.callsPerMonth).toBe(2250);
    expect(t.priceGbp).toBe(1599);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: 3000 calls / £1999", () => {
    const t = VOICE_TIERS[2];
    expect(t.callsPerMonth).toBe(3000);
    expect(t.priceGbp).toBe(1999);
  });
  it("Voice setup: £1000 one agent / £1500 two agents / £500 second-agent add-on", () => {
    expect(VOICE_SETUP_GBP.oneAgent).toBe(1000);
    expect(VOICE_SETUP_GBP.twoAgents).toBe(1500);
    expect(VOICE_SETUP_GBP.secondAgentAddOn).toBe(500);
  });
});

describe("Double Decker bundle tiers", () => {
  it("Ignition: single £1599 / bundle £1999", () => {
    const t = BUNDLE_TIERS[0];
    expect(t.single.priceGbp).toBe(1599);
    expect(t.bundle.priceGbp).toBe(1999);
  });
  it("In Motion: single £2499 / bundle £3199 / featured", () => {
    const t = BUNDLE_TIERS[1];
    expect(t.single.priceGbp).toBe(2499);
    expect(t.bundle.priceGbp).toBe(3199);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: single £2999 / bundle £3799", () => {
    const t = BUNDLE_TIERS[2];
    expect(t.single.priceGbp).toBe(2999);
    expect(t.bundle.priceGbp).toBe(3799);
  });
  it("Bundle setup: £1500 one voice agent / £2000 two voice agents", () => {
    expect(BUNDLE_SETUP_GBP.oneVoiceAgent).toBe(1500);
    expect(BUNDLE_SETUP_GBP.twoVoiceAgents).toBe(2000);
  });
});

describe("Extra voice credit", () => {
  it("is £0.90 per call", () => {
    expect(EXTRA_CALL_PRICE_GBP).toBe(0.9);
  });
});

describe("Currencies", () => {
  it("GBP/EUR/USD with GBP as base", () => {
    expect(CURRENCIES).toEqual(["GBP", "EUR", "USD"]);
    expect(BASE_CURRENCY).toBe("GBP");
  });
});

describe("convert()", () => {
  it("GBP is identity", () => {
    expect(convert(499, "GBP", RATES)).toBe(499);
  });
  it("EUR multiplies by the EUR rate", () => {
    expect(convert(1000, "EUR", RATES)).toBeCloseTo(1180, 5);
  });
  it("USD multiplies by the USD rate", () => {
    expect(convert(1000, "USD", RATES)).toBeCloseTo(1270, 5);
  });
  it("falls back to 1x when a rate is missing", () => {
    expect(convert(500, "USD", { GBP: 1, EUR: 1.18 } as never)).toBe(500);
  });
});

describe("formatPrice()", () => {
  it("GBP 499 → £499 (no decimals by default)", () => {
    expect(formatPrice("GBP", 499)).toBe("£499");
  });
  it("EUR 1180 → €1,180", () => {
    expect(formatPrice("EUR", 1180)).toBe("€1,180");
  });
  it("USD 1270 → $1,270", () => {
    expect(formatPrice("USD", 1270)).toBe("$1,270");
  });
  it("rounds to whole numbers by default", () => {
    expect(formatPrice("GBP", 1180.6)).toBe("£1,181");
  });
  it("supports 2 decimals for the per-call credit", () => {
    expect(formatPrice("GBP", 0.9, { decimals: 2 })).toBe("£0.90");
  });
});

describe("priceFor()", () => {
  it("converts then formats in one call", () => {
    expect(priceFor(1000, "EUR", RATES)).toBe("€1,180");
  });
  it("supports decimals for credit", () => {
    expect(priceFor(0.9, "USD", RATES, 2)).toBe("$1.14");
  });
});
