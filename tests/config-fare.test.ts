// tests/config-fare.test.ts
import { describe, it, expect } from "vitest";
import { computeFare, type FareRule } from "@/lib/config/fare";

const rule: FareRule = { base_fare: 3, per_mile: 2, per_min: 0.25, min_fare: 8, airport_surcharge: 5 };

describe("computeFare", () => {
  it("sums base + distance + time", () => {
    // 3 + (4 * 2) + (10 * 0.25) = 3 + 8 + 2.5 = 13.5
    expect(computeFare(4, 10, rule, false)).toBe(13.5);
  });
  it("applies the minimum fare floor", () => {
    // 3 + (0.5*2) + (2*0.25) = 4.5 → floored to 8
    expect(computeFare(0.5, 2, rule, false)).toBe(8);
  });
  it("adds the airport surcharge when flagged", () => {
    // 13.5 + 5 = 18.5
    expect(computeFare(4, 10, rule, true)).toBe(18.5);
  });
  it("rounds to 2dp", () => {
    // inputs chosen above the min-fare floor so rounding (not the floor) is exercised:
    // 3 + (2.345*2) + (6.7*0.25) = 3 + 4.69 + 1.675 = 9.365 → 9.37
    expect(computeFare(2.345, 6.7, rule, false)).toBe(9.37);
  });
});
