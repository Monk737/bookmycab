import { describe, it, expect } from "vitest";
import {
  mapAddress,
  mapZone,
  mapCapability,
  mapQuote,
  mapBooking,
  mapBookingStatus,
  mapFlight,
  toQuoteBody,
  toBookingBody,
} from "@/lib/dispatch/autocab/mappers";
import type { QuoteParams, BookingParams } from "@/lib/dispatch/types";

describe("mapAddress", () => {
  it("maps a full AutoCab address row", () => {
    expect(
      mapAddress({
        id: 42,
        text: "10 Downing St, London",
        zone: "SW1",
        postCode: "SW1A 2AA",
        latitude: 51.5,
        longitude: -0.12,
      }),
    ).toEqual({
      id: "42",
      label: "10 Downing St, London",
      zone: "SW1",
      postcode: "SW1A 2AA",
      lat: 51.5,
      lng: -0.12,
    });
  });
  it("tolerates missing optional fields", () => {
    expect(mapAddress({ id: 7, text: "Somewhere" })).toEqual({
      id: "7",
      label: "Somewhere",
      zone: null,
      postcode: null,
      lat: null,
      lng: null,
    });
  });
});

describe("mapZone / mapCapability", () => {
  it("maps a zone", () => {
    expect(mapZone({ id: 3, name: "LHR T5" })).toEqual({ id: "3", name: "LHR T5" });
  });
  it("maps a capability with passenger count", () => {
    expect(mapCapability({ id: 1, name: "Saloon", maxPassengers: 4 })).toEqual({
      id: "1",
      name: "Saloon",
      passengers: 4,
    });
  });
  it("maps a capability with no passenger count", () => {
    expect(mapCapability({ id: 2, name: "Estate" })).toEqual({
      id: "2",
      name: "Estate",
      passengers: null,
    });
  });
});

describe("mapQuote", () => {
  it("maps price/eta/currency", () => {
    expect(
      mapQuote({ price: 23.5, currency: "GBP", etaMinutes: 8, vehicleType: "Saloon" }),
    ).toEqual({ price: 23.5, currency: "GBP", etaMinutes: 8, vehicleType: "Saloon" });
  });
  it("defaults currency to GBP and eta to null", () => {
    expect(mapQuote({ price: 10 })).toEqual({
      price: 10,
      currency: "GBP",
      etaMinutes: null,
      vehicleType: null,
    });
  });
});

describe("mapBookingStatus", () => {
  it("normalises known AutoCab statuses", () => {
    expect(mapBookingStatus("Active")).toBe("confirmed");
    expect(mapBookingStatus("Dispatched")).toBe("dispatched");
    expect(mapBookingStatus("Completed")).toBe("completed");
    expect(mapBookingStatus("Cancelled")).toBe("cancelled");
    expect(mapBookingStatus("NoShow")).toBe("no_show");
  });
  it("defaults unknown/empty to confirmed", () => {
    expect(mapBookingStatus("Weird")).toBe("confirmed");
    expect(mapBookingStatus(null)).toBe("confirmed");
  });
});

describe("mapBooking", () => {
  it("maps a booking and preserves the raw payload", () => {
    const raw = {
      bookingId: 9001,
      status: "Active",
      price: 30,
      currency: "GBP",
      pickupTime: "2026-06-01T14:30:00.000Z",
      vehicleType: "MPV",
    };
    const result = mapBooking(raw);
    expect(result.dispatchRef).toBe("9001");
    expect(result.status).toBe("confirmed");
    expect(result.price).toBe(30);
    expect(result.currency).toBe("GBP");
    expect(result.pickupTime).toBe("2026-06-01T14:30:00.000Z");
    expect(result.vehicleType).toBe("MPV");
    expect(result.raw).toBe(raw);
  });
});

describe("mapFlight", () => {
  it("maps a flight and fills airline from IATA when vendor omits it", () => {
    expect(
      mapFlight({
        flightNumber: "BA245",
        origin: "GRU",
        scheduledArrival: "2026-06-01T06:00:00.000Z",
        estimatedArrival: "2026-06-01T06:12:00.000Z",
        terminal: "5",
      }),
    ).toEqual({
      flightNumber: "BA245",
      airline: "British Airways",
      origin: "GRU",
      scheduledArrival: "2026-06-01T06:00:00.000Z",
      estimatedArrival: "2026-06-01T06:12:00.000Z",
      terminal: "5",
    });
  });
  it("prefers a vendor-provided airline name", () => {
    expect(mapFlight({ flightNumber: "ZZ999", airline: "Mystery Air" }).airline).toBe(
      "Mystery Air",
    );
  });
});

describe("toQuoteBody / toBookingBody", () => {
  const pickup = { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 };
  const destination = { label: "B", zone: "Z2", postcode: "P2", lat: 3, lng: 4 };

  it("builds a quote body", () => {
    const params: QuoteParams = {
      companyId: 55,
      pickup,
      destination,
      vehicleType: "Saloon",
      pickupTime: "2026-06-01T14:00:00.000Z",
    };
    expect(toQuoteBody(params)).toEqual({
      companyId: 55,
      pickup: { text: "A", zone: "Z1", postCode: "P1", latitude: 1, longitude: 2 },
      destination: { text: "B", zone: "Z2", postCode: "P2", latitude: 3, longitude: 4 },
      vehicleType: "Saloon",
      pickupTime: "2026-06-01T14:00:00.000Z",
    });
  });

  it("builds a booking body with passenger details", () => {
    const params: BookingParams = {
      companyId: 55,
      pickup,
      destination,
      pickupTime: "2026-06-01T14:30:00.000Z",
      vehicleType: "MPV",
      passengerName: "Jo Bloggs",
      passengerPhone: "+447700900000",
      quotedPrice: 30,
      notes: "Meet at arrivals",
    };
    expect(toBookingBody(params)).toEqual({
      companyId: 55,
      pickup: { text: "A", zone: "Z1", postCode: "P1", latitude: 1, longitude: 2 },
      destination: { text: "B", zone: "Z2", postCode: "P2", latitude: 3, longitude: 4 },
      pickupTime: "2026-06-01T14:30:00.000Z",
      vehicleType: "MPV",
      passengerName: "Jo Bloggs",
      passengerPhone: "+447700900000",
      price: 30,
      notes: "Meet at arrivals",
    });
  });
});
