import { describe, it, expect } from "vitest";
import { percentile, summarize } from "@/lib/observability/percentile";

describe("percentile", () => {
  it("computes nearest-rank percentiles on 1..10", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 95)).toBe(10);
    expect(percentile(v, 99)).toBe(10);
  });
  it("is order-independent and returns 0 for an empty set", () => {
    expect(percentile([10, 1, 5], 50)).toBe(5);
    expect(percentile([], 95)).toBe(0);
  });
});

describe("summarize", () => {
  it("reports count, p50/p95/p99, and max", () => {
    expect(summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({
      count: 10, p50: 5, p95: 10, p99: 10, max: 10,
    });
    expect(summarize([])).toEqual({ count: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });
});
