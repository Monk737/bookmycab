import { describe, it, expect } from "vitest";
import { reduceCallStats, reduceDayTrend } from "@/lib/dashboard/product-overview";

type Row = { automation_id: string; outcome: string; duration_s: number | null; credit_source: string; started_at: string };
const row = (p: Partial<Row>): Row => ({
  automation_id: "a1",
  outcome: "booked",
  duration_s: 60,
  credit_source: "plan",
  started_at: "2026-06-10T09:00:00Z",
  ...p,
});

describe("reduceCallStats", () => {
  it("aggregates totals, booked %, avg duration, outcomes and credit split", () => {
    const rows = [
      row({ outcome: "booked", duration_s: 100, credit_source: "plan" }),
      row({ outcome: "booked", duration_s: 200, credit_source: "topup" }),
      row({ outcome: "abandoned", duration_s: null, credit_source: "none" }),
      row({ outcome: "quoted", duration_s: 60, credit_source: "plan" }),
    ];
    const s = reduceCallStats(rows);
    expect(s.totalCalls).toBe(4);
    expect(s.booked).toBe(2);
    expect(s.bookedPct).toBe(50);
    expect(s.avgDurationS).toBe(120); // (100+200+60)/3, null skipped
    expect(s.creditSplit).toEqual({ plan: 2, topup: 1, none: 1 });
    // outcomes ranked by the canonical order, zero-count ones dropped
    expect(s.outcomes.map((o) => [o.outcome, o.count])).toEqual([
      ["booked", 2],
      ["quoted", 1],
      ["abandoned", 1],
    ]);
  });

  it("empty input yields zeros, not NaN", () => {
    const s = reduceCallStats([]);
    expect(s).toMatchObject({ totalCalls: 0, booked: 0, bookedPct: 0, avgDurationS: 0 });
    expect(s.outcomes).toHaveLength(0);
  });

  it("treats any non-plan/topup credit_source as 'none'", () => {
    const s = reduceCallStats([row({ credit_source: "plan" }), row({ credit_source: "" }), row({ credit_source: "weird" })]);
    expect(s.creditSplit).toEqual({ plan: 1, topup: 0, none: 2 });
  });
});

describe("reduceDayTrend", () => {
  const now = new Date("2026-06-12T12:00:00Z");
  it("fills every day in the window, zero where no calls", () => {
    const t = reduceDayTrend([], 7, now);
    expect(t).toHaveLength(7);
    expect(t[0].date).toBe("2026-06-06");
    expect(t[6].date).toBe("2026-06-12");
    expect(t.every((d) => d.calls === 0 && d.booked === 0)).toBe(true);
  });
  it("buckets calls into their day and counts booked", () => {
    const rows = [
      row({ started_at: "2026-06-12T08:00:00Z", outcome: "booked" }),
      row({ started_at: "2026-06-12T20:00:00Z", outcome: "abandoned" }),
      row({ started_at: "2026-06-10T10:00:00Z", outcome: "booked" }),
      row({ started_at: "2026-01-01T10:00:00Z", outcome: "booked" }), // outside window → ignored
    ];
    const t = reduceDayTrend(rows, 7, now);
    const d12 = t.find((d) => d.date === "2026-06-12")!;
    const d10 = t.find((d) => d.date === "2026-06-10")!;
    expect(d12).toMatchObject({ calls: 2, booked: 1 });
    expect(d10).toMatchObject({ calls: 1, booked: 1 });
    expect(t.reduce((s, d) => s + d.calls, 0)).toBe(3); // out-of-window dropped
  });
});
