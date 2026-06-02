import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceFunnel, reduceChannelMix, reduceModeSplit, reduceVehicleSplit, reduceTopZones, reduceHeatmap, reduceAbandonment } from "@/lib/dashboard/analytics";

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
