import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { reduceAirportStats } from "@/lib/dashboard/insights";

const airportBooking1 = {
  airport_json: {
    code: "LHR",
    name: "Heathrow Airport",
    flightNumber: "BA123",
    arrivalTerminal: "5",
  },
  pickup_time_mode: "airport",
};

const airportBooking2 = {
  airport_json: {
    code: "LHR",
    name: "Heathrow Airport",
    flightNumber: "EK007",
    arrivalTerminal: "3",
  },
  pickup_time_mode: "airport",
};

const groundBooking = {
  airport_json: null,
  pickup_time_mode: "asap",
};

describe("reduceAirportStats", () => {
  it("counts airport vs total and computes share percentage", () => {
    const stats = reduceAirportStats([airportBooking1, airportBooking2, groundBooking]);
    expect(stats.totalBookings).toBe(3);
    expect(stats.airportBookings).toBe(2);
    expect(stats.airportSharePct).toBe(67); // Math.round(2/3 * 100)
  });

  it("groups topAirports by code and sorts descending", () => {
    const stats = reduceAirportStats([airportBooking1, airportBooking2, groundBooking]);
    expect(stats.topAirports[0]).toMatchObject({ name: "LHR", value: 2 });
  });

  it("groups topTerminals as 'CODE Tterm' and sorts descending", () => {
    const stats = reduceAirportStats([airportBooking1, airportBooking2, groundBooking]);
    // T5 (1) and T3 (1) — order is stable but both value=1; just check both present
    const terminals = stats.topTerminals.map((t) => t.name);
    expect(terminals).toContain("LHR T5");
    expect(terminals).toContain("LHR T3");
  });

  it("detects airport booking via pickup_time_mode alone when airport_json lacks code", () => {
    const modeOnly = { airport_json: {}, pickup_time_mode: "airport" };
    const stats = reduceAirportStats([modeOnly, groundBooking]);
    expect(stats.airportBookings).toBe(1);
    expect(stats.airportSharePct).toBe(50);
  });

  it("returns zeroed stats for empty input", () => {
    const stats = reduceAirportStats([]);
    expect(stats).toEqual({
      airportBookings: 0,
      totalBookings: 0,
      airportSharePct: 0,
      topAirports: [],
      topTerminals: [],
    });
  });
});
