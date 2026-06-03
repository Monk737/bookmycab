import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceOrgKpis } from "@/lib/dashboard/queries";

describe("reduceOrgKpis", () => {
  it("sums revenue and counts bookings across the tenant", () => {
    const k = reduceOrgKpis([
      { fare: 20, status: "completed" }, { fare: 30, status: "cancelled" }, { fare: null, status: "confirmed" },
    ]);
    expect(k.bookings30d).toBe(3);
    expect(k.revenue30d).toBe(50);
  });
  it("is zero-safe with no bookings", () => {
    expect(reduceOrgKpis([])).toEqual({ bookings30d: 0, revenue30d: 0 });
  });
});
