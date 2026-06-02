import { describe, it, expect } from "vitest";
import { DispatchError, DispatchNotImplementedError, DispatchConfigError } from "@/lib/dispatch/errors";

describe("dispatch errors", () => {
  it("DispatchError is an Error with the given message", () => {
    const e = new DispatchError("boom");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("DispatchError");
    expect(e.message).toBe("boom");
  });

  it("DispatchNotImplementedError names the vendor + method, neutrally", () => {
    const e = new DispatchNotImplementedError("iCabbi", "createBooking");
    expect(e).toBeInstanceOf(DispatchError);
    expect(e.name).toBe("DispatchNotImplementedError");
    expect(e.message).toBe("iCabbi dispatch is not yet available.");
    expect(e.method).toBe("createBooking");
    expect(e.message).not.toMatch(/n8n|workflow|execution/i);
  });

  it("DispatchConfigError is a DispatchError", () => {
    expect(new DispatchConfigError("bad")).toBeInstanceOf(DispatchError);
  });
});

import { ICabbiAdapter } from "@/lib/dispatch/icabbi/adapter";
import { CordicAdapter } from "@/lib/dispatch/cordic/adapter";
import type { DispatchAdapter } from "@/lib/dispatch/types";

const addr = { label: "A", zone: null, postcode: null, lat: null, lng: null };

function bookingParams() {
  return {
    companyId: 1,
    pickup: addr,
    destination: addr,
    pickupTime: "2026-06-01T14:00:00.000Z",
    passengerName: "Jo",
    passengerPhone: "+447700900000",
  };
}

/** Every DispatchAdapter method on a stub must reject with NotImplemented. */
function assertAllNotImplemented(adapter: DispatchAdapter, vendorWord: RegExp) {
  const calls: Array<Promise<unknown>> = [
    adapter.lookupAddress("x", 1),
    adapter.getZones(1),
    adapter.getCapabilities(1),
    adapter.getQuote({ companyId: 1, pickup: addr, destination: addr }),
    adapter.createBooking(bookingParams()),
    adapter.getBooking("1", 1),
    adapter.modifyBooking("1", {}),
    adapter.cancelBooking("1", 1),
    adapter.searchFlights("BA245", 1),
  ];
  return Promise.all(
    calls.map((p) =>
      p.then(
        () => { throw new Error("expected rejection"); },
        (e: Error) => {
          expect(e).toBeInstanceOf(DispatchNotImplementedError);
          expect(e.message).toMatch(vendorWord);
          expect(e.message).not.toMatch(/n8n|workflow|execution/i);
        },
      ),
    ),
  );
}

describe("ICabbiAdapter stub", () => {
  it("throws DispatchNotImplementedError on every method", async () => {
    await assertAllNotImplemented(new ICabbiAdapter(), /iCabbi/);
  });
});

describe("CordicAdapter stub", () => {
  it("throws DispatchNotImplementedError on every method", async () => {
    await assertAllNotImplemented(new CordicAdapter(), /Cordic/);
  });
});
