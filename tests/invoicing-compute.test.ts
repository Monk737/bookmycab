// tests/invoicing-compute.test.ts
import { describe, it, expect } from "vitest";
import { computeInvoice, type InvoiceBooking } from "@/lib/invoicing/compute";

const bookings: InvoiceBooking[] = [
  { id: "b1", passenger_name: "Sam", fare: 20, created_at: "2026-05-02T10:00:00Z" },
  { id: "b2", passenger_name: "Lee", fare: 35.5, created_at: "2026-05-10T10:00:00Z" },
  { id: "b3", passenger_name: null, fare: null, created_at: "2026-05-12T10:00:00Z" },
];

describe("computeInvoice", () => {
  it("creates one line item per booking and sums the subtotal", () => {
    const inv = computeInvoice(bookings, 0);
    expect(inv.lineItems).toHaveLength(3);
    expect(inv.subtotal).toBe(55.5);
  });
  it("applies markup percentage to the subtotal", () => {
    const inv = computeInvoice(bookings, 10);
    expect(inv.markup).toBe(5.55);
    expect(inv.total).toBe(61.05);
  });
  it("zero markup yields total == subtotal", () => {
    const inv = computeInvoice(bookings, 0);
    expect(inv.total).toBe(55.5);
  });
  it("treats null fares as 0", () => {
    const inv = computeInvoice([{ id: "x", passenger_name: null, fare: null, created_at: "2026-05-01T00:00:00Z" }], 20);
    expect(inv.subtotal).toBe(0);
    expect(inv.total).toBe(0);
  });
  it("rounds money to 2dp", () => {
    const inv = computeInvoice([{ id: "x", passenger_name: "A", fare: 33.333, created_at: "2026-05-01T00:00:00Z" }], 7.5);
    expect(inv.markup).toBe(2.5);
    expect(inv.total).toBe(35.83);
  });
});
