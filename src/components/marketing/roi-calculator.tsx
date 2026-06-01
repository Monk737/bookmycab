"use client";

import { useId, useState } from "react";
import { computeRoi } from "@/lib/marketing/roi";
import {
  CURRENCIES,
  formatPrice,
  type Currency,
} from "@/lib/marketing/pricing";

/** Parse a numeric input value to a non-negative number (NaN → 0). */
function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-gray-200 bg-paper px-4 py-3 text-lg " +
  "font-medium text-ink tabular-nums transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink " +
  "focus-visible:border-ink";

const LABEL_CLASS = "block text-sm font-medium text-gray-600";

/**
 * Interactive ROI calculator: estimates the booking revenue a cab company
 * recovers per day / month / year by automating missed bookings.
 *
 * Pure math lives in computeRoi(); this component only manages input state
 * and currency-formatted display.
 */
export function RoiCalculator() {
  const missedId = useId();
  const fareId = useId();
  const currencyId = useId();

  const [missedBookingsPerDay, setMissed] = useState("4");
  const [avgFare, setFare] = useState("18");
  const [currency, setCurrency] = useState<Currency>("GBP");

  const roi = computeRoi({
    missedBookingsPerDay: toNumber(missedBookingsPerDay),
    avgFare: toNumber(avgFare),
  });

  return (
    <div className="grid gap-10 rounded-3xl border border-gray-200 bg-gray-50 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
      {/* Inputs */}
      <div className="grid gap-6">
        <div>
          <label htmlFor={missedId} className={LABEL_CLASS}>
            Missed bookings per day
          </label>
          <input
            id={missedId}
            type="number"
            min={0}
            step={1}
            value={missedBookingsPerDay}
            onChange={(e) => setMissed(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor={fareId} className={LABEL_CLASS}>
            Average fare
          </label>
          <input
            id={fareId}
            type="number"
            min={0}
            step={1}
            value={avgFare}
            onChange={(e) => setFare(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor={currencyId} className={LABEL_CLASS}>
            Currency
          </label>
          <select
            id={currencyId}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className={INPUT_CLASS}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Output — announced to assistive tech as inputs change */}
      <div
        className="grid gap-5"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Recovered revenue estimate"
      >
        <div className="rounded-2xl bg-accent p-6 text-accent-ink">
          <p className="text-sm font-medium uppercase tracking-[0.12em]">
            Recovered every year
          </p>
          <p
            data-testid="roi-per-year"
            className="mt-2 font-display text-5xl font-semibold leading-none tracking-tight tabular-nums sm:text-6xl"
          >
            {formatPrice(currency, roi.perYear)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl border border-gray-200 bg-paper p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
              Per day
            </p>
            <p
              data-testid="roi-per-day"
              className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink"
            >
              {formatPrice(currency, roi.perDay)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-paper p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
              Per month
            </p>
            <p
              data-testid="roi-per-month"
              className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink"
            >
              {formatPrice(currency, roi.perMonth)}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Estimate only. You bring your numbers — your automation does the rest.
        </p>
      </div>
    </div>
  );
}
