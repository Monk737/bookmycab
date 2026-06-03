import { describe, it, expect } from "vitest";
import { runLoad } from "@/lib/observability/load";

describe("runLoad", () => {
  it("runs exactly `total` sends across a bounded worker pool and collects latencies", async () => {
    let inFlight = 0, maxInFlight = 0;
    const res = await runLoad({
      total: 20,
      concurrency: 4,
      send: async () => {
        inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return 7;
      },
    });
    expect(res.count).toBe(20);
    expect(res.errors).toBe(0);
    expect(res.latencies).toHaveLength(20);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("counts failed sends without aborting the run", async () => {
    const res = await runLoad({
      total: 6,
      concurrency: 2,
      send: async (i) => { if (i % 2 === 0) throw new Error("fail"); return 1; },
    });
    expect(res.count).toBe(3);
    expect(res.errors).toBe(3);
  });
});
