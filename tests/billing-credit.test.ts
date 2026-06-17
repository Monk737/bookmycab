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
  it("unit £0.90, min £9, three packs", () => {
    expect(CREDIT_UNIT_GBP).toBe(0.9);
    expect(MIN_TOPUP_GBP).toBe(9);
    expect(CREDIT_PACKS.map((p) => [p.gbp, p.credits])).toEqual([[9, 10], [45, 50], [90, 100]]);
  });
});

describe("creditsForGbp", () => {
  it("floors to whole credits", () => {
    expect(creditsForGbp(9)).toBe(10);   // 9 / 0.9 = 10
    expect(creditsForGbp(45)).toBe(50);
    expect(creditsForGbp(10)).toBe(11);  // 11.11 → 11
  });
});

describe("validateCustomTopup", () => {
  it("accepts >= £9", () => {
    expect(validateCustomTopup(9)).toEqual({ ok: true, credits: 10 });
    expect(validateCustomTopup(20)).toEqual({ ok: true, credits: 22 });
  });
  it("rejects < £9 and non-finite", () => {
    expect(validateCustomTopup(5).ok).toBe(false);
    expect(validateCustomTopup(NaN).ok).toBe(false);
  });
});

describe("creditsForGbpAt (custom overage)", () => {
  it("uses the given unit price", () => {
    expect(creditsForGbpAt(15, 0.75)).toBe(20);   // 15 / 0.75
    expect(creditsForGbpAt(9, 0.9)).toBe(10);      // base rate
  });
  it("falls back to base rate for non-positive unit", () => {
    expect(creditsForGbpAt(9, 0)).toBe(10);
  });
});

describe("resolveTopupAmount", () => {
  it("resolves a pack id to gbp + credits", () => {
    expect(resolveTopupAmount({ packId: "pack_50" })).toEqual({ ok: true, gbp: 45, credits: 50 });
  });
  it("resolves a custom amount", () => {
    expect(resolveTopupAmount({ customGbp: 18 })).toEqual({ ok: true, gbp: 18, credits: 20 });
  });
  it("rejects an unknown pack or a too-small custom amount", () => {
    expect(resolveTopupAmount({ packId: "nope" }).ok).toBe(false);
    expect(resolveTopupAmount({ customGbp: 1 }).ok).toBe(false);
  });
});
