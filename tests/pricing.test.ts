/**
 * Tests for src/lib/marketing/pricing.ts
 *
 * Verifies all §6.1 pricing values, formatPrice helper, setup fee, and
 * contract length. Written before the implementation (TDD — must fail first).
 */

import { describe, it, expect } from "vitest";
import {
  PRICING,
  SETUP_FEE,
  CONTRACT_MONTHS,
  CURRENCIES,
  formatPrice,
  type Currency,
  type PricingOption,
} from "@/lib/marketing/pricing";

describe("Pricing — Option A (up to 25 drivers)", () => {
  const optionA = PRICING.A;

  it("single channel GBP", () => {
    expect(optionA.single.GBP).toBe(500);
  });
  it("single channel EUR", () => {
    expect(optionA.single.EUR).toBe(500);
  });
  it("single channel USD", () => {
    expect(optionA.single.USD).toBe(600);
  });

  it("bundle GBP", () => {
    expect(optionA.bundle.GBP).toBe(1000);
  });
  it("bundle EUR", () => {
    expect(optionA.bundle.EUR).toBe(1000);
  });
  it("bundle USD", () => {
    expect(optionA.bundle.USD).toBe(1200);
  });

  it("bundle requires minimum 3 channels", () => {
    expect(optionA.bundleMinChannels).toBe(3);
  });
});

describe("Pricing — Option B (26–100 drivers)", () => {
  const optionB = PRICING.B;

  it("single channel GBP", () => {
    expect(optionB.single.GBP).toBe(800);
  });
  it("single channel EUR", () => {
    expect(optionB.single.EUR).toBe(800);
  });
  it("single channel USD", () => {
    expect(optionB.single.USD).toBe(800);
  });

  it("bundle GBP", () => {
    expect(optionB.bundle.GBP).toBe(1800);
  });
  it("bundle EUR", () => {
    expect(optionB.bundle.EUR).toBe(1800);
  });
  it("bundle USD", () => {
    expect(optionB.bundle.USD).toBe(2000);
  });

  it("bundle requires minimum 3 channels", () => {
    expect(optionB.bundleMinChannels).toBe(3);
  });
});

describe("Pricing — Option C (101+ drivers / 4+ channels / custom)", () => {
  it("has no fixed numeric price — returns null for GBP single", () => {
    expect(PRICING.C.single.GBP).toBeNull();
  });
  it("has no fixed numeric price — returns null for EUR bundle", () => {
    expect(PRICING.C.bundle.EUR).toBeNull();
  });
  it("is marked as contact-only", () => {
    expect(PRICING.C.contactOnly).toBe(true);
  });
});

describe("Setup Fee (§6.1 one-time)", () => {
  it("GBP setup fee is 1000", () => {
    expect(SETUP_FEE.GBP).toBe(1000);
  });
  it("EUR setup fee is 1000", () => {
    expect(SETUP_FEE.EUR).toBe(1000);
  });
  it("USD setup fee is 1200", () => {
    expect(SETUP_FEE.USD).toBe(1200);
  });
});

describe("Contract length", () => {
  it("minimum contract is 12 months", () => {
    expect(CONTRACT_MONTHS).toBe(12);
  });
});

describe("formatPrice helper", () => {
  it("GBP 500 → £500", () => {
    expect(formatPrice("GBP", 500)).toBe("£500");
  });
  it("EUR 1000 → €1,000", () => {
    expect(formatPrice("EUR", 1000)).toBe("€1,000");
  });
  it("USD 1200 → $1,200", () => {
    expect(formatPrice("USD", 1200)).toBe("$1,200");
  });
  it("GBP 1000 → £1,000", () => {
    expect(formatPrice("GBP", 1000)).toBe("£1,000");
  });
  it("USD 600 → $600", () => {
    expect(formatPrice("USD", 600)).toBe("$600");
  });
  it("EUR 500 → €500", () => {
    expect(formatPrice("EUR", 500)).toBe("€500");
  });
  it("no decimal places", () => {
    // Whole numbers only — no .00 suffix
    expect(formatPrice("GBP", 800)).not.toContain(".");
  });
});

describe("CURRENCIES export", () => {
  it("includes GBP, EUR, USD", () => {
    expect(CURRENCIES).toContain("GBP");
    expect(CURRENCIES).toContain("EUR");
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toHaveLength(3);
  });
});
