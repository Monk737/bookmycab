import { describe, it, expect } from "vitest";
import { pickupTimeFromArrival } from "@/lib/dispatch/airport-buffer";

describe("pickupTimeFromArrival", () => {
  it("adds the default 30-minute buffer", () => {
    expect(pickupTimeFromArrival("2026-06-01T14:00:00.000Z")).toBe(
      "2026-06-01T14:30:00.000Z",
    );
  });
  it("respects a custom buffer", () => {
    expect(pickupTimeFromArrival("2026-06-01T14:00:00.000Z", 45)).toBe(
      "2026-06-01T14:45:00.000Z",
    );
  });
  it("rolls over hours/days correctly", () => {
    expect(pickupTimeFromArrival("2026-06-01T23:50:00.000Z", 30)).toBe(
      "2026-06-02T00:20:00.000Z",
    );
  });
  it("throws on an unparseable arrival time", () => {
    expect(() => pickupTimeFromArrival("not-a-date")).toThrow();
  });
  it("rejects a negative buffer", () => {
    expect(() => pickupTimeFromArrival("2026-06-01T14:00:00.000Z", -5)).toThrow();
  });
});
