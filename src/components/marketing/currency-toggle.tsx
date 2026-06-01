"use client";

import { CURRENCIES, type Currency } from "@/lib/marketing/pricing";

type CurrencyToggleProps = {
  value: Currency;
  onChange: (currency: Currency) => void;
  className?: string;
};

/**
 * Controlled GBP/EUR/USD segmented switch.
 *
 * Presentational only — the selected currency is owned by the parent
 * (PricingCards) and passed back via onChange. Implemented as an accessible
 * radiogroup: arrow keys move between options, Tab enters/leaves the group.
 */
export function CurrencyToggle({
  value,
  onChange,
  className = "",
}: CurrencyToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Display currency"
      className={
        "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 " +
        className
      }
    >
      {CURRENCIES.map((currency) => {
        const selected = currency === value;
        return (
          <button
            key={currency}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(currency)}
            className={
              "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium tracking-tight transition-colors duration-200 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 " +
              (selected
                ? "bg-accent text-accent-ink"
                : "text-gray-600 hover:text-ink")
            }
          >
            {currency}
          </button>
        );
      })}
    </div>
  );
}
