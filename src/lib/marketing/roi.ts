/**
 * CabbyBot ROI calculator — pure, currency-agnostic math.
 *
 * Computes the revenue a taxi company loses per day/month/year from missed
 * bookings that CabbyBot's automation recovers.
 *
 * Model:
 *   perDay   = round(missedBookingsPerDay * avgFare)
 *   perMonth = perDay * workingDaysPerMonth  (default: DEFAULT_WORKING_DAYS_PER_MONTH)
 *   perYear  = perDay * DAYS_PER_YEAR
 *
 * Assumptions:
 *   - Negative or NaN inputs are clamped to 0 (no negative ROI).
 *   - All results are whole integers (rounded to nearest unit via Math.round).
 *   - perMonth and perYear are derived from the already-rounded perDay so
 *     rounding error does not compound across the scaling factors.
 *   - Currency is excluded — call formatPrice() from pricing.ts to display.
 */

/** Default working days per month used when the caller does not override. */
export const DEFAULT_WORKING_DAYS_PER_MONTH = 30;

/** Calendar days per year for the annual projection. */
export const DAYS_PER_YEAR = 365;

export interface RoiInput {
  /** Number of bookings lost per day that the automation would have captured. */
  missedBookingsPerDay: number;
  /** Average fare value per booking (any currency, caller's responsibility). */
  avgFare: number;
  /**
   * Working days per month to use for the monthly projection.
   * Defaults to DEFAULT_WORKING_DAYS_PER_MONTH (30) when omitted.
   */
  workingDays?: number;
}

export interface RoiResult {
  /** Revenue recovered per day (whole integer). */
  perDay: number;
  /** Revenue recovered per month (perDay × workingDays). */
  perMonth: number;
  /** Revenue recovered per year (perDay × DAYS_PER_YEAR). */
  perYear: number;
}

/** Clamp a value to ≥ 0; treat NaN as 0. */
function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/**
 * Compute the recoverable revenue for a taxi company using CabbyBot.
 *
 * @param input - missedBookingsPerDay, avgFare, optional workingDays override
 * @returns ROI breakdown: perDay, perMonth, perYear (all whole integers)
 */
export function computeRoi(input: RoiInput): RoiResult {
  const bookings = clampNonNegative(input.missedBookingsPerDay);
  const fare = clampNonNegative(input.avgFare);
  const workingDaysPerMonth =
    input.workingDays !== undefined
      ? clampNonNegative(input.workingDays)
      : DEFAULT_WORKING_DAYS_PER_MONTH;

  const perDay = Math.round(bookings * fare);
  const perMonth = perDay * workingDaysPerMonth;
  const perYear = perDay * DAYS_PER_YEAR;

  return { perDay, perMonth, perYear };
}
