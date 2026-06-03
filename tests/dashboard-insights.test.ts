import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceDailyTrend, reduceResponseStats, reduceRevenue } from "@/lib/dashboard/insights";

describe("reduceDailyTrend", () => {
  it("buckets current + previous counts across the day axis", () => {
    const pts = reduceDailyTrend(
      [{ created_at: "2026-06-02T10:00:00Z" }, { created_at: "2026-06-02T12:00:00Z" }, { created_at: "2026-06-03T09:00:00Z" }],
      [{ created_at: "2026-05-31T10:00:00Z" }], // previous window is the 2 days before `from`
      "2026-06-02", "2026-06-03",
    );
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ current: 2 }); // 2 Jun
    expect(pts[1]).toMatchObject({ current: 1 }); // 3 Jun
    // previous-period day 0 (31 May) aligns to bucket 0
    expect(pts[0].previous).toBe(1);
    expect(pts[1].previous).toBe(0);
  });
  it("returns a zero-filled axis when there is no data", () => {
    const pts = reduceDailyTrend([], [], "2026-06-01", "2026-06-03");
    expect(pts).toHaveLength(3);
    expect(pts.every((p) => p.current === 0 && p.previous === 0)).toBe(true);
  });
});

describe("reduceResponseStats", () => {
  it("measures seconds from each conversation's first inbound to the next outbound", () => {
    const msgs = [
      { conversation_id: "c1", direction: "inbound", ts: "2026-06-03T10:00:00Z" },
      { conversation_id: "c1", direction: "outbound", ts: "2026-06-03T10:00:30Z" }, // 30s
      { conversation_id: "c2", direction: "inbound", ts: "2026-06-03T11:00:00Z" },
      { conversation_id: "c2", direction: "outbound", ts: "2026-06-03T11:00:10Z" }, // 10s
    ];
    const s = reduceResponseStats(msgs);
    expect(s.sampleSize).toBe(2);
    expect(s.avgSeconds).toBe(20);
    expect(s.p95Seconds).toBe(30);
  });
  it("ignores conversations with no inbound→outbound pair", () => {
    const s = reduceResponseStats([{ conversation_id: "c1", direction: "inbound", ts: "2026-06-03T10:00:00Z" }]);
    expect(s).toEqual({ sampleSize: 0, avgSeconds: 0, p50Seconds: 0, p95Seconds: 0 });
  });
});

describe("reduceRevenue", () => {
  it("totals fares, averages, and computes completion + status split", () => {
    const r = reduceRevenue([
      { fare: 20, status: "completed" }, { fare: 30, status: "completed" },
      { fare: 10, status: "cancelled" }, { fare: null, status: "confirmed" },
    ]);
    expect(r.bookingCount).toBe(4);
    expect(r.totalFare).toBe(60);
    expect(r.avgFare).toBe(20); // 60 / 3 fares present
    expect(r.completedCount).toBe(2);
    expect(r.completionPct).toBe(50);
    expect(r.byStatus[0]).toMatchObject({ name: "completed", value: 2 });
  });
});
