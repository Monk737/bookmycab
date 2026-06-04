// tests/dispatchops-health.test.ts
import { describe, it, expect } from "vitest";
import { reduceAdapterHealth, type AttemptLite } from "@/lib/dispatchops/health";

const attempts: AttemptLite[] = [
  { adapter: "autocab", status: "success", latency_ms: 100 },
  { adapter: "autocab", status: "success", latency_ms: 200 },
  { adapter: "autocab", status: "failed", latency_ms: 5000 },
  { adapter: "icabbi", status: "success", latency_ms: 50 },
];

describe("reduceAdapterHealth", () => {
  it("groups by adapter with totals + success rate", () => {
    const h = reduceAdapterHealth(attempts);
    const ac = h.find((x) => x.adapter === "autocab")!;
    expect(ac.total).toBe(3);
    expect(ac.succeeded).toBe(2);
    expect(ac.failed).toBe(1);
    expect(ac.successRate).toBeCloseTo(66.7, 1);
  });
  it("computes p95 latency per adapter", () => {
    const ac = reduceAdapterHealth(attempts).find((x) => x.adapter === "autocab")!;
    // p95 of [100,200,5000] → index ceil(0.95*3)-1 = 2 → 5000
    expect(ac.p95LatencyMs).toBe(5000);
  });
  it("sorts adapters by total desc", () => {
    const h = reduceAdapterHealth(attempts);
    expect(h[0].adapter).toBe("autocab");
  });
  it("handles empty input", () => {
    expect(reduceAdapterHealth([])).toEqual([]);
  });
});
