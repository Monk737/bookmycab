import { describe, it, expect } from "vitest";
import {
  CREDIT_UNIT_GBP,
  MIN_TOPUP_GBP,
  CREDIT_PACKS,
  creditsForGbp,
  creditsForGbpAt,
  validateCustomTopup,
  resolveTopupAmount,
} from "@/lib/billing/credit";

describe("constants + packs", () => {
  it("base unit £2, min £9, three £2/credit packs", () => {
    expect(CREDIT_UNIT_GBP).toBe(2);
    expect(MIN_TOPUP_GBP).toBe(9);
    expect(CREDIT_PACKS).toEqual([
      { id: "pack_10", gbp: 20, credits: 10 },
      { id: "pack_50", gbp: 100, credits: 50 },
      { id: "pack_100", gbp: 200, credits: 100 },
    ]);
  });
});

describe("creditsForGbp", () => {
  it("floors to whole credits", () => {
    expect(creditsForGbp(20)).toBe(10);  // 20 / 2 = 10
    expect(creditsForGbp(100)).toBe(50); // 100 / 2 = 50
    expect(creditsForGbp(11)).toBe(5);   // 11 / 2 = 5.5 → 5
  });
});

describe("validateCustomTopup", () => {
  it("accepts >= £9", () => {
    expect(validateCustomTopup(20)).toEqual({ ok: true, credits: 10 });
    expect(validateCustomTopup(10)).toEqual({ ok: true, credits: 5 });
  });
  it("rejects < £9 and non-finite", () => {
    expect(validateCustomTopup(5).ok).toBe(false);
    expect(validateCustomTopup(NaN).ok).toBe(false);
  });
});

describe("creditsForGbpAt (custom overage)", () => {
  it("uses the given unit price", () => {
    expect(creditsForGbpAt(15, 0.75)).toBe(20);   // 15 / 0.75
    expect(creditsForGbpAt(20)).toBe(10);           // 20 / 2 = 10 (new base default)
  });
  it("falls back to base rate for non-positive unit", () => {
    expect(creditsForGbpAt(20, 0)).toBe(10);        // falls back to £2 base
  });
});

describe("resolveTopupAmount", () => {
  it("resolves a pack id to gbp + credits", () => {
    expect(resolveTopupAmount({ packId: "pack_50" })).toEqual({ ok: true, gbp: 100, credits: 50 });
  });
  it("resolves a custom amount", () => {
    expect(resolveTopupAmount({ customGbp: 20 })).toEqual({ ok: true, gbp: 20, credits: 10 });
  });
  it("rejects an unknown pack or a too-small custom amount", () => {
    expect(resolveTopupAmount({ packId: "nope" }).ok).toBe(false);
    expect(resolveTopupAmount({ customGbp: 1 }).ok).toBe(false);
  });
});
