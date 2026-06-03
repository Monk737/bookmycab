import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceFunnel, reduceChannelMix, reduceModeSplit, reduceVehicleSplit, reduceTopZones, reduceHeatmap, reduceAbandonment, reduceVoiceStats, getVoiceStats } from "@/lib/dashboard/analytics";

describe("reduceFunnel", () => {
  it("counts conversations through outcome stages", () => {
    const convs = [{ outcome: "booked" }, { outcome: "quoted" }, { outcome: "abandoned" }, { outcome: "booked" }];
    const f = reduceFunnel(convs as never, 2);
    expect(f.inbound).toBe(4);
    expect(f.booked).toBe(2);
    expect(f.quoted).toBeGreaterThanOrEqual(2);
  });
});

describe("reduceChannelMix", () => {
  it("counts conversations per channel id/handle", () => {
    const rows = reduceChannelMix([{ channel_id: "c1" }, { channel_id: "c1" }, { channel_id: "c2" }] as never);
    const c1 = rows.find((r) => r.name === "c1");
    expect(c1?.value).toBe(2);
  });
});

describe("reduceModeSplit / reduceVehicleSplit", () => {
  it("buckets bookings by mode and vehicle", () => {
    const bookings = [{ pickup_time_mode: "asap", vehicle_type: "Saloon" }, { pickup_time_mode: "airport", vehicle_type: "MPV" }, { pickup_time_mode: "asap", vehicle_type: "Saloon" }];
    expect(reduceModeSplit(bookings as never).find((r) => r.name === "asap")?.value).toBe(2);
    expect(reduceVehicleSplit(bookings as never).find((r) => r.name === "Saloon")?.value).toBe(2);
  });
});

describe("reduceTopZones", () => {
  it("ranks pickup zones by count with percentage", () => {
    const bookings = [
      { pickup_address: { zone: "LHR T123" } }, { pickup_address: { zone: "LHR T123" } }, { pickup_address: { zone: "SW1" } },
    ];
    const zones = reduceTopZones(bookings as never, "pickup_address");
    expect(zones[0]).toMatchObject({ zone: "LHR T123", count: 2 });
    expect(zones[0].pct).toBe(67);
  });
});

describe("reduceHeatmap", () => {
  it("produces a 7x24 grid keyed by weekday/hour", () => {
    const cells = reduceHeatmap([{ created_at: "2026-06-01T14:00:00.000Z" }] as never);
    const cell = cells.find((c) => c.day === 1 && c.hour === 14);
    expect(cell?.value).toBe(1);
    expect(cells.length).toBe(7 * 24);
  });
});

describe("reduceAbandonment", () => {
  it("counts abandonment reasons", () => {
    const rows = reduceAbandonment([{ abandonment_reason: "no_pickup" }, { abandonment_reason: "no_pickup" }, { abandonment_reason: null }] as never);
    expect(rows.find((r) => r.reason === "no_pickup")?.count).toBe(2);
  });
});

describe("reduceVoiceStats", () => {
  const conversations = [
    { id: "c1", outcome: "booked", language: "en" },
    { id: "c2", outcome: "abandoned", language: "ar" },
    { id: "c3", outcome: "booked", language: "en" }, // no voice note
  ];
  const voiceMessages = [
    { conversation_id: "c1", transcript: "Taxi from Paddington to Soho please" }, // 35 chars
    { conversation_id: "c2", transcript: "" },                                     // failed transcription
  ];

  it("counts voice notes, voice conversations, and share of all conversations", () => {
    const s = reduceVoiceStats(voiceMessages as never, conversations as never);
    expect(s.totalVoiceNotes).toBe(2);
    expect(s.voiceConversations).toBe(2); // c1, c2
    expect(s.totalConversations).toBe(3);
    expect(s.voiceSharePct).toBe(67); // 2/3
  });

  it("computes transcription success, avg transcript length, and voice→booking rate", () => {
    const s = reduceVoiceStats(voiceMessages as never, conversations as never);
    expect(s.transcribedPct).toBe(50); // 1 of 2 has a non-empty transcript
    expect(s.avgTranscriptChars).toBe(35); // averaged over transcribed notes only
    expect(s.voiceBookingPct).toBe(50); // c1 booked of {c1, c2}
  });

  it("breaks voice conversations down by language, descending", () => {
    const s = reduceVoiceStats(voiceMessages as never, conversations as never);
    expect(s.languages).toEqual([
      { name: "ar", value: 1 },
      { name: "en", value: 1 },
    ]);
  });

  it("returns all-zero stats with no division-by-zero when there is no voice data", () => {
    const s = reduceVoiceStats([], []);
    expect(s).toEqual({
      totalVoiceNotes: 0, voiceConversations: 0, totalConversations: 0,
      voiceSharePct: 0, transcribedPct: 0, voiceBookingPct: 0,
      avgTranscriptChars: 0, languages: [],
    });
  });
});

describe("getVoiceStats", () => {
  it("queries conversations in range then voice messages, and reduces them", async () => {
    const calls: string[] = [];
    // Minimal chainable fake of the Supabase query builder used by getVoiceStats.
    function makeBuilder(rows: unknown[]) {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "lte", "in"]) {
        b[m] = (..._a: unknown[]) => b; // chainable
      }
      // resolves to { data } when awaited
      b.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows });
      return b;
    }
    const fake = {
      from(table: string) {
        calls.push(table);
        if (table === "conversations") {
          return makeBuilder([
            { id: "c1", outcome: "booked", language: "en" },
            { id: "c2", outcome: "abandoned", language: "ar" },
          ]);
        }
        return makeBuilder([
          { conversation_id: "c1", transcript: "hello there driver" },
          { conversation_id: "c2", transcript: "" },
        ]);
      },
    };
    const s = await getVoiceStats("a1", {}, fake as never);
    expect(calls).toEqual(["conversations", "messages"]);
    expect(s.totalConversations).toBe(2);
    expect(s.voiceConversations).toBe(2);
    expect(s.transcribedPct).toBe(50);
  });

  it("skips the messages query and returns zeros when there are no conversations", async () => {
    const calls: string[] = [];
    function emptyBuilder() {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "lte", "in"]) b[m] = () => b;
      b.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: [] });
      return b;
    }
    const fake = { from(t: string) { calls.push(t); return emptyBuilder(); } };
    const s = await getVoiceStats("a1", {}, fake as never);
    expect(calls).toEqual(["conversations"]); // messages query skipped
    expect(s.totalVoiceNotes).toBe(0);
  });
});
