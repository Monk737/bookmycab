import { describe, it, expect } from "vitest";
import { planBandLabel, slugify, type PlanBand } from "@/lib/admin/plan-bands";

describe("planBandLabel (legacy display)", () => {
  it("labels legacy band values and null", () => {
    expect(planBandLabel("Custom")).toMatch(/custom/i);
    expect(planBandLabel("A-Single")).toMatch(/legacy/i);
    expect(planBandLabel("B-Bundle")).toMatch(/legacy/i);
    expect(planBandLabel(null)).toBe("—");
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

  it("accepts a legacy band value as a valid PlanBand union member", () => {
    const first: PlanBand = "A-Single";
    expect(first).toBe("A-Single");
  });
});
