// tests/admin-benchmarks.test.ts
import { describe, it, expect } from "vitest";
import { percentiles } from "@/lib/admin/benchmarks";

describe("percentiles", () => {
  it("computes p25/p50/p75 (nearest-rank) for a series", () => {
    const p = percentiles([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(p.p50).toBe(40); // nearest-rank median
    expect(p.p25).toBe(20);
    expect(p.p75).toBe(60);
    expect(p.sampleSize).toBe(8);
  });
  it("handles a single value", () => {
    const p = percentiles([42]);
    expect(p.p25).toBe(42);
    expect(p.p50).toBe(42);
    expect(p.p75).toBe(42);
  });
  it("returns nulls + zero sample for an empty series", () => {
    const p = percentiles([]);
    expect(p.p50).toBeNull();
    expect(p.sampleSize).toBe(0);
  });
});
