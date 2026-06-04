// tests/crm-aggregate.test.ts
import { describe, it, expect } from "vitest";
import { reduceCustomerStats, type BookingLite, type ConversationLite } from "@/lib/crm/aggregate";

const bookings: BookingLite[] = [
  { fare: 20, vehicle_type: "saloon", created_at: "2026-01-10T10:00:00Z", passenger_name: "Sam" },
  { fare: 35.5, vehicle_type: "estate", created_at: "2026-03-02T10:00:00Z", passenger_name: "Sam" },
  { fare: 15, vehicle_type: "saloon", created_at: "2026-02-01T10:00:00Z", passenger_name: "Sam" },
];
const convos: ConversationLite[] = [
  { customer_name: "Sam", started_at: "2026-01-09T09:00:00Z" },
  { customer_name: "Sam", started_at: "2026-03-05T09:00:00Z" },
];

describe("reduceCustomerStats", () => {
  it("totals bookings + spend", () => {
    const s = reduceCustomerStats(bookings, convos);
    expect(s.totalBookings).toBe(3);
    expect(s.totalSpend).toBe(70.5);
  });
  it("picks the most frequent vehicle as preferred", () => {
    expect(reduceCustomerStats(bookings, convos).preferredVehicle).toBe("saloon");
  });
  it("computes first/last seen across bookings + conversations", () => {
    const s = reduceCustomerStats(bookings, convos);
    expect(s.firstSeen).toBe("2026-01-09T09:00:00.000Z");
    expect(s.lastSeen).toBe("2026-03-05T09:00:00.000Z");
  });
  it("derives a name from the latest non-empty source", () => {
    expect(reduceCustomerStats(bookings, convos).name).toBe("Sam");
  });
  it("handles an empty customer", () => {
    const s = reduceCustomerStats([], []);
    expect(s.totalBookings).toBe(0);
    expect(s.totalSpend).toBe(0);
    expect(s.firstSeen).toBeNull();
    expect(s.preferredVehicle).toBeNull();
  });
});
