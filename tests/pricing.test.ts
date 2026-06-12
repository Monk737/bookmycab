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
  BUNDLE_SETUP_GBP,
  BUNDLE_CHAT_DISCOUNT_GBP,
  bundleChatPriceGbp,
  bundleTotalGbp,
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
  it("Ignition: £599 / ≤50 fleet", () => {
    const t = CHAT_TIERS[0];
    expect(t.priceGbp).toBe(599);
    expect(t.fleet).toContain("50");
  });
  it("In Motion: £999 / 51–100 fleet / featured", () => {
    const t = CHAT_TIERS[1];
    expect(t.priceGbp).toBe(999);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: £1299 / priced (not contact-only)", () => {
    const t = CHAT_TIERS[2];
    expect(t.priceGbp).toBe(1299);
    expect(t.note).toBeTruthy();
  });
  it("Chat setup fee is £1000", () => {
    expect(CHAT_SETUP_FEE_GBP).toBe(1000);
  });
});

describe("Voice tiers", () => {
  it("Ignition: 1500 calls / £1299 / 1 number 1 agent", () => {
    const t = VOICE_TIERS[0];
    expect(t.callsPerMonth).toBe(1500);
    expect(t.priceGbp).toBe(1299);
    expect(t.config).toMatch(/1 number/i);
  });
  it("In Motion: 2250 calls / £1799 / featured", () => {
    const t = VOICE_TIERS[1];
    expect(t.callsPerMonth).toBe(2250);
    expect(t.priceGbp).toBe(1799);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: 3000 calls / £2199", () => {
    const t = VOICE_TIERS[2];
    expect(t.callsPerMonth).toBe(3000);
    expect(t.priceGbp).toBe(2199);
  });
  it("Voice setup: £1000 one agent / £1500 two agents / £500 second-agent add-on", () => {
    expect(VOICE_SETUP_GBP.oneAgent).toBe(1000);
    expect(VOICE_SETUP_GBP.twoAgents).toBe(1500);
    expect(VOICE_SETUP_GBP.secondAgentAddOn).toBe(500);
  });
});

describe("Double Decker (Mix & Match)", () => {
  it("chat discounts: ignition −100, in_motion −200, full_throttle −300", () => {
    expect(BUNDLE_CHAT_DISCOUNT_GBP.ignition).toBe(100);
    expect(BUNDLE_CHAT_DISCOUNT_GBP.in_motion).toBe(200);
    expect(BUNDLE_CHAT_DISCOUNT_GBP.full_throttle).toBe(300);
  });
  it("bundle chat price = chat list − discount", () => {
    expect(bundleChatPriceGbp("ignition")).toBe(499); // 599 − 100
    expect(bundleChatPriceGbp("in_motion")).toBe(799); // 999 − 200
    expect(bundleChatPriceGbp("full_throttle")).toBe(999); // 1299 − 300
  });
  it("bundle total = full voice price + discounted chat", () => {
    // In Motion voice (£1799) + Ignition chat (£499) = £2298
    expect(bundleTotalGbp("in_motion", "ignition")).toBe(2298);
    // Full Throttle voice (£2199) + Full Throttle chat (£999) = £3198
    expect(bundleTotalGbp("full_throttle", "full_throttle")).toBe(3198);
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
