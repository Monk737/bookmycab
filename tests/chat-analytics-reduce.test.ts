import { describe, it, expect } from "vitest";
import { reduceChatStats, reduceChatTrend, reduceByChannel } from "@/lib/dashboard/chat-analytics";
import type { ChannelType } from "@/lib/dashboard/product-overview";

type Row = {
  channel_id: string | null;
  outcome: string | null;
  started_at: string;
  customer_handle: string | null;
  customer_name: string | null;
};
const row = (p: Partial<Row>): Row => ({
  channel_id: "c1",
  outcome: "booked",
  started_at: "2026-06-10T09:00:00Z",
  customer_handle: "+44 7700 900000",
  customer_name: "Pat",
  ...p,
});

describe("reduceChatStats", () => {
  it("aggregates totals, booked %, and ranked outcomes (unknown for unrecognised)", () => {
    const rows = [
      row({ outcome: "booked" }),
      row({ outcome: "booked" }),
      row({ outcome: "managed" }),
      row({ outcome: "abandoned" }),
      row({ outcome: "weird" }), // -> unknown
      row({ outcome: null }), // -> unknown
    ];
    const s = reduceChatStats(rows);
    expect(s.totalConversations).toBe(6);
    expect(s.booked).toBe(2);
    expect(s.bookedPct).toBe(33); // 2/6
    expect(s.outcomes.map((o) => [o.outcome, o.count])).toEqual([
      ["booked", 2],
      ["managed", 1],
      ["abandoned", 1],
      ["unknown", 2],
    ]);
  });

  it("empty input yields zeros, not NaN", () => {
    const s = reduceChatStats([]);
    expect(s).toMatchObject({ totalConversations: 0, booked: 0, bookedPct: 0 });
    expect(s.outcomes).toHaveLength(0);
  });
});

describe("reduceChatTrend", () => {
  const now = new Date("2026-06-12T12:00:00Z");
  it("fills every day and counts booked per day", () => {
    const rows = [
      row({ started_at: "2026-06-12T08:00:00Z", outcome: "booked" }),
      row({ started_at: "2026-06-12T20:00:00Z", outcome: "abandoned" }),
      row({ started_at: "2026-06-10T10:00:00Z", outcome: "booked" }),
      row({ started_at: "2026-01-01T10:00:00Z", outcome: "booked" }), // outside window
    ];
    const t = reduceChatTrend(rows, 7, now);
    expect(t).toHaveLength(7);
    expect(t.find((d) => d.date === "2026-06-12")).toMatchObject({ conversations: 2, booked: 1 });
    expect(t.find((d) => d.date === "2026-06-10")).toMatchObject({ conversations: 1, booked: 1 });
    expect(t.reduce((s, d) => s + d.conversations, 0)).toBe(3);
  });
});

describe("reduceByChannel", () => {
  it("buckets by mapped channel type, skipping unmapped/null channel_ids", () => {
    const map = new Map<string, ChannelType>([
      ["c1", "whatsapp"],
      ["c2", "telegram"],
    ]);
    const rows = [
      row({ channel_id: "c1" }),
      row({ channel_id: "c1" }),
      row({ channel_id: "c2" }),
      row({ channel_id: "c9" }), // unmapped -> skipped
      row({ channel_id: null }), // null -> skipped
    ];
    const counts = reduceByChannel(rows, map);
    expect(counts.get("whatsapp")).toBe(2);
    expect(counts.get("telegram")).toBe(1);
    expect(counts.size).toBe(2);
  });
});
