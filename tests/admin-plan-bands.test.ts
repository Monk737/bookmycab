import { describe, it, expect } from "vitest";
import {
  PLAN_BANDS,
  planBandLabel,
  planBandMonthlyPrice,
  slugify,
  type PlanBand,
} from "@/lib/admin/plan-bands";

describe("PLAN_BANDS", () => {
  it("lists the five bands matching the tenants.plan_band CHECK", () => {
    expect(PLAN_BANDS).toEqual([
      "A-Single",
      "A-Bundle",
      "B-Single",
      "B-Bundle",
      "Custom",
    ]);
  });
});

describe("planBandLabel", () => {
  it("returns a distinct human label for every band", () => {
    const labels = PLAN_BANDS.map(planBandLabel);
    expect(new Set(labels).size).toBe(PLAN_BANDS.length);
    expect(planBandLabel("Custom")).toMatch(/custom/i);
    expect(planBandLabel("A-Single")).toMatch(/single/i);
    expect(planBandLabel("B-Bundle")).toMatch(/bundle/i);
  });
});

describe("planBandMonthlyPrice", () => {
  it("returns the §6.1 GBP prices", () => {
    expect(planBandMonthlyPrice("A-Single", "GBP")).toBe(500);
    expect(planBandMonthlyPrice("A-Bundle", "GBP")).toBe(1000);
    expect(planBandMonthlyPrice("B-Single", "GBP")).toBe(800);
    expect(planBandMonthlyPrice("B-Bundle", "GBP")).toBe(1800);
  });

  it("returns the §6.1 EUR prices", () => {
    expect(planBandMonthlyPrice("A-Single", "EUR")).toBe(500);
    expect(planBandMonthlyPrice("A-Bundle", "EUR")).toBe(1000);
    expect(planBandMonthlyPrice("B-Single", "EUR")).toBe(800);
    expect(planBandMonthlyPrice("B-Bundle", "EUR")).toBe(1800);
  });

  it("returns the §6.1 USD prices (A tier differs from GBP/EUR)", () => {
    expect(planBandMonthlyPrice("A-Single", "USD")).toBe(600);
    expect(planBandMonthlyPrice("A-Bundle", "USD")).toBe(1200);
    expect(planBandMonthlyPrice("B-Single", "USD")).toBe(800);
    expect(planBandMonthlyPrice("B-Bundle", "USD")).toBe(2000);
  });

  it("returns null for Custom in every currency", () => {
    expect(planBandMonthlyPrice("Custom", "GBP")).toBeNull();
    expect(planBandMonthlyPrice("Custom", "EUR")).toBeNull();
    expect(planBandMonthlyPrice("Custom", "USD")).toBeNull();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Speedy Cabs")).toBe("speedy-cabs");
  });

  it("strips non-alphanumerics and trailing punctuation", () => {
    expect(slugify("Speedy Cabs Ltd.")).toBe("speedy-cabs-ltd");
  });

  it("collapses runs of separators into a single hyphen", () => {
    expect(slugify("  A&B  Taxis  ")).toBe("a-b-taxis");
    expect(slugify("City--Cars")).toBe("city-cars");
  });

  it("keeps digits", () => {
    expect(slugify("24/7 Cabs")).toBe("24-7-cabs");
  });

  it("transliterates accented Latin characters instead of dropping them", () => {
    expect(slugify("Éclair Cabs")).toBe("eclair-cabs");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("---")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("has no leading or trailing hyphens", () => {
    const out: string = slugify("!!Acme!!");
    expect(out).toBe("acme");
    expect(out.startsWith("-")).toBe(false);
    expect(out.endsWith("-")).toBe(false);
  });

  it("accepts every band value as a valid PlanBand union member", () => {
    // Compile-time guard that PLAN_BANDS is typed as PlanBand[].
    const first: PlanBand = PLAN_BANDS[0];
    expect(first).toBe("A-Single");
  });
});
