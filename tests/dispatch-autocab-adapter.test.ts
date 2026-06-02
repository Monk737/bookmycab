import { describe, it, expect, vi } from "vitest";

// server-only throws outside the react-server condition (Vitest); stub it.
vi.mock("server-only", () => ({}));

import { AutoCabAdapter } from "@/lib/dispatch/autocab/adapter";
import { DispatchError } from "@/lib/dispatch/errors";

const config = { baseUrl: "https://acme.autocab.test", subscriptionKey: "sub-key-123" };

/** Builds a fake fetch returning `body` as JSON, recording the call. */
function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    // Node's Response constructor rejects a body on 204/304; pass null for those.
    const noBody = status === 204 || status === 304;
    return new Response(noBody ? null : JSON.stringify(body), {
      status,
      headers: noBody ? {} : { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("AutoCabAdapter.lookupAddress", () => {
  it("POSTs /address with the subscription-key header and maps results", async () => {
    const { fetcher, calls } = fakeFetch({
      results: [{ id: 1, text: "10 Downing St", zone: "SW1", postCode: "SW1A 2AA" }],
    });
    const adapter = new AutoCabAdapter(config, fetcher);
    const out = await adapter.lookupAddress("downing", 55);

    expect(out).toEqual([
      { id: "1", label: "10 Downing St", zone: "SW1", postcode: "SW1A 2AA", lat: null, lng: null },
    ]);
    expect(calls[0].url).toBe("https://acme.autocab.test/address");
    expect(calls[0].init?.method).toBe("POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["Ocp-Apim-Subscription-Key"]).toBe("sub-key-123");
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ text: "downing", companyId: 55 });
  });
});

describe("AutoCabAdapter.getZones / getCapabilities", () => {
  it("GETs /zones?companyId= and maps", async () => {
    const { fetcher, calls } = fakeFetch({ zones: [{ id: 3, name: "LHR T5" }] });
    const out = await new AutoCabAdapter(config, fetcher).getZones(55);
    expect(out).toEqual([{ id: "3", name: "LHR T5" }]);
    expect(calls[0].url).toBe("https://acme.autocab.test/zones?companyId=55");
    expect(calls[0].init?.method ?? "GET").toBe("GET");
  });
  it("GETs /capabilities?companyId= and maps", async () => {
    const { fetcher, calls } = fakeFetch({
      capabilities: [{ id: 1, name: "Saloon", maxPassengers: 4 }],
    });
    const out = await new AutoCabAdapter(config, fetcher).getCapabilities(55);
    expect(out).toEqual([{ id: "1", name: "Saloon", passengers: 4 }]);
    expect(calls[0].url).toBe("https://acme.autocab.test/capabilities?companyId=55");
  });
});

describe("AutoCabAdapter.getQuote", () => {
  it("POSTs /quote and returns a normalised quote", async () => {
    const { fetcher, calls } = fakeFetch({ price: 23.5, currency: "GBP", etaMinutes: 8 });
    const out = await new AutoCabAdapter(config, fetcher).getQuote({
      companyId: 55,
      pickup: { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 },
      destination: { label: "B", zone: "Z2", postcode: "P2", lat: 3, lng: 4 },
      vehicleType: "Saloon",
      pickupTime: "2026-06-01T14:00:00.000Z",
    });
    expect(out).toEqual({ price: 23.5, currency: "GBP", etaMinutes: 8, vehicleType: null });
    expect(calls[0].url).toBe("https://acme.autocab.test/quote");
    expect(calls[0].init?.method).toBe("POST");
  });
});

describe("AutoCabAdapter booking CRUD", () => {
  const base = {
    companyId: 55,
    pickup: { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 },
    destination: { label: "B", zone: "Z2", postcode: "P2", lat: 3, lng: 4 },
    pickupTime: "2026-06-01T14:30:00.000Z",
    passengerName: "Jo",
    passengerPhone: "+447700900000",
  };

  it("createBooking POSTs /booking and maps the result", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Active", price: 30, currency: "GBP" });
    const out = await new AutoCabAdapter(config, fetcher).createBooking(base);
    expect(out.dispatchRef).toBe("9001");
    expect(out.status).toBe("confirmed");
    expect(calls[0].url).toBe("https://acme.autocab.test/booking");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("getBooking GETs /booking/{id}?companyId=", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Dispatched" });
    const out = await new AutoCabAdapter(config, fetcher).getBooking("9001", 55);
    expect(out.status).toBe("dispatched");
    expect(calls[0].url).toBe("https://acme.autocab.test/booking/9001?companyId=55");
  });

  it("modifyBooking PATCHes /booking/{id}", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Active" });
    const out = await new AutoCabAdapter(config, fetcher).modifyBooking("9001", {
      pickupTime: "2026-06-01T15:00:00.000Z",
    });
    expect(out.dispatchRef).toBe("9001");
    expect(calls[0].url).toBe("https://acme.autocab.test/booking/9001");
    expect(calls[0].init?.method).toBe("PATCH");
  });

  it("modifyBooking translates changed fields to AutoCab JSON shapes (not neutral DTO names)", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Active" });
    await new AutoCabAdapter(config, fetcher).modifyBooking("9001", {
      pickup: { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 },
      quotedPrice: 42,
    });
    // The PATCH body must use AutoCab field names (text/postCode/latitude/price),
    // never the neutral DTO names (label/postcode/lat/quotedPrice).
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      pickup: { text: "A", zone: "Z1", postCode: "P1", latitude: 1, longitude: 2 },
      price: 42,
    });
  });

  it("cancelBooking DELETEs /booking/{id}?companyId= and returns void", async () => {
    const { fetcher, calls } = fakeFetch({}, 204);
    const out = await new AutoCabAdapter(config, fetcher).cancelBooking("9001", 55);
    expect(out).toBeUndefined();
    expect(calls[0].url).toBe("https://acme.autocab.test/booking/9001?companyId=55");
    expect(calls[0].init?.method).toBe("DELETE");
  });
});

describe("AutoCabAdapter.searchFlights", () => {
  it("GETs /flights/search and maps", async () => {
    const { fetcher, calls } = fakeFetch({
      flights: [{ flightNumber: "BA245", terminal: "5", scheduledArrival: "2026-06-01T06:00:00.000Z" }],
    });
    const out = await new AutoCabAdapter(config, fetcher).searchFlights("BA245", 55);
    expect(out[0].airline).toBe("British Airways");
    expect(out[0].terminal).toBe("5");
    expect(calls[0].url).toBe(
      "https://acme.autocab.test/flights/search?flightNumber=BA245&companyId=55",
    );
  });
});

describe("AutoCabAdapter error handling", () => {
  it("throws a neutral DispatchError on a non-2xx response", async () => {
    const { fetcher } = fakeFetch({ error: "bad" }, 500);
    await expect(
      new AutoCabAdapter(config, fetcher).getZones(55),
    ).rejects.toBeInstanceOf(DispatchError);
  });
});
