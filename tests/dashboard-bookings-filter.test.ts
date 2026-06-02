import { describe, it, expect } from "vitest";
import { parseBookingFilter, parseConversationFilter, bookingToCsvRow, BOOKING_CSV_HEADERS } from "@/lib/dashboard/bookings-filter";

describe("parseBookingFilter", () => {
  it("defaults page=1 limit=50 with no params", () => {
    const f = parseBookingFilter(new URLSearchParams());
    expect(f).toMatchObject({ page: 1, limit: 50 });
  });
  it("reads and clamps paging + passes through filters", () => {
    const f = parseBookingFilter(new URLSearchParams("page=3&limit=999&status=confirmed&channel=whatsapp&mode=airport&search=SL1&from=2026-06-01&to=2026-06-07"));
    expect(f.page).toBe(3);
    expect(f.limit).toBe(100);
    expect(f).toMatchObject({ status: "confirmed", channel: "whatsapp", mode: "airport", search: "SL1" });
    expect(f.from).toContain("2026-06-01");
    expect(f.to).toContain("2026-06-07");
  });
  it("rejects an out-of-enum status (drops it)", () => {
    const f = parseBookingFilter(new URLSearchParams("status=bogus"));
    expect(f.status).toBeUndefined();
  });
  it("treats page<1 as 1", () => {
    expect(parseBookingFilter(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseBookingFilter(new URLSearchParams("page=-5")).page).toBe(1);
  });
});

describe("parseConversationFilter", () => {
  it("validates outcome enum", () => {
    expect(parseConversationFilter(new URLSearchParams("outcome=booked")).outcome).toBe("booked");
    expect(parseConversationFilter(new URLSearchParams("outcome=nope")).outcome).toBeUndefined();
  });
});

describe("bookingToCsvRow", () => {
  it("emits columns in header order", () => {
    const row = bookingToCsvRow({
      id: "b1", dispatchRef: "AC9", pickupAtUtc: "2026-06-01T14:00:00.000Z",
      passengerName: "Jo", customerHandle: "+447700900000", channelType: "whatsapp",
      pickupAddress: { town: "Slough", postcode: "SL1 1AA" }, destinationAddress: { town: "London", postcode: "W1" },
      vehicleType: "Saloon", passengerCount: 2, fare: 23.5, currency: "GBP",
      status: "confirmed", pickupTimeMode: "asap",
    });
    expect(row.length).toBe(BOOKING_CSV_HEADERS.length);
    expect(row[0]).toBe("b1");
    expect(row).toContain("AC9");
  });
});
