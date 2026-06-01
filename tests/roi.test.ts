/**
 * Tests for src/lib/marketing/roi.ts
 *
 * Verifies the computeRoi pure function and its documented model constants.
 * Written before the implementation (TDD — must fail first).
 *
 * ROI Model (documented here as the spec):
 *   perDay  = missedBookingsPerDay * avgFare
 *   perMonth = perDay * DEFAULT_WORKING_DAYS_PER_MONTH  (30)
 *   perYear  = perDay * DAYS_PER_YEAR                   (365)
 *   All results rounded to nearest whole integer (Math.round).
 *   Negative or NaN inputs are clamped to 0 before computation.
 *   Currency is NOT part of the math — caller formats with formatPrice.
 */

import { describe, it, expect } from "vitest";
import {
  computeRoi,
  DEFAULT_WORKING_DAYS_PER_MONTH,
  DAYS_PER_YEAR,
} from "@/lib/marketing/roi";

describe("ROI model constants", () => {
  it("DEFAULT_WORKING_DAYS_PER_MONTH is 30", () => {
    expect(DEFAULT_WORKING_DAYS_PER_MONTH).toBe(30);
  });
  it("DAYS_PER_YEAR is 365", () => {
    expect(DAYS_PER_YEAR).toBe(365);
  });
});

describe("computeRoi — zero inputs", () => {
  it("all zeros in → all zeros out", () => {
    const result = computeRoi({ missedBookingsPerDay: 0, avgFare: 0 });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });

  it("zero missed bookings, non-zero fare → all zeros", () => {
    const result = computeRoi({ missedBookingsPerDay: 0, avgFare: 25 });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });

  it("non-zero missed bookings, zero fare → all zeros", () => {
    const result = computeRoi({ missedBookingsPerDay: 5, avgFare: 0 });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });
});

describe("computeRoi — representative case", () => {
  /**
   * Hand-computed expected values:
   *   missedBookingsPerDay = 10, avgFare = 20
   *   perDay  = 10 * 20          = 200
   *   perMonth = 200 * 30        = 6000
   *   perYear  = 200 * 365       = 73000
   */
  const result = computeRoi({ missedBookingsPerDay: 10, avgFare: 20 });

  it("perDay = 200", () => {
    expect(result.perDay).toBe(200);
  });
  it("perMonth = 6000", () => {
    expect(result.perMonth).toBe(6000);
  });
  it("perYear = 73000", () => {
    expect(result.perYear).toBe(73000);
  });
});

describe("computeRoi — rounding (fractional fares)", () => {
  /**
   * Hand-computed:
   *   missedBookingsPerDay = 3, avgFare = 7.5
   *   perDay  = 3 * 7.5   = 22.5 → round → 23
   *   perMonth = 23 * 30  = 690  (rounded perDay used consistently)
   *   perYear  = 23 * 365 = 8395
   */
  const result = computeRoi({ missedBookingsPerDay: 3, avgFare: 7.5 });

  it("perDay rounds to 23", () => {
    expect(result.perDay).toBe(23);
  });
  it("perMonth = 23 * 30 = 690", () => {
    expect(result.perMonth).toBe(690);
  });
  it("perYear = 23 * 365 = 8395", () => {
    expect(result.perYear).toBe(8395);
  });
});

describe("computeRoi — negative / invalid input clamped to 0", () => {
  it("negative missedBookingsPerDay → all zeros", () => {
    const result = computeRoi({ missedBookingsPerDay: -5, avgFare: 20 });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });

  it("negative avgFare → all zeros", () => {
    const result = computeRoi({ missedBookingsPerDay: 5, avgFare: -20 });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });

  it("NaN missedBookingsPerDay → all zeros", () => {
    const result = computeRoi({ missedBookingsPerDay: NaN, avgFare: 20 });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });

  it("NaN avgFare → all zeros", () => {
    const result = computeRoi({ missedBookingsPerDay: 5, avgFare: NaN });
    expect(result.perDay).toBe(0);
    expect(result.perMonth).toBe(0);
    expect(result.perYear).toBe(0);
  });
});

describe("computeRoi — optional workingDays override", () => {
  /**
   * When workingDays is provided it overrides DEFAULT_WORKING_DAYS_PER_MONTH
   * for the perMonth calculation only. perYear still uses DAYS_PER_YEAR.
   *
   * Hand-computed:
   *   missedBookingsPerDay = 5, avgFare = 10, workingDays = 22
   *   perDay  = 5 * 10   = 50
   *   perMonth = 50 * 22 = 1100
   *   perYear  = 50 * 365 = 18250
   */
  const result = computeRoi({
    missedBookingsPerDay: 5,
    avgFare: 10,
    workingDays: 22,
  });

  it("perDay = 50", () => {
    expect(result.perDay).toBe(50);
  });
  it("perMonth uses custom workingDays = 22 → 1100", () => {
    expect(result.perMonth).toBe(1100);
  });
  it("perYear still uses DAYS_PER_YEAR → 18250", () => {
    expect(result.perYear).toBe(18250);
  });
});
