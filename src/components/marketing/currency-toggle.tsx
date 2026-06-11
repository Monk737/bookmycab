"use client";

import { useRef } from "react";
import { CURRENCIES, type Currency } from "@/lib/marketing/pricing";

type CurrencyToggleProps = {
  value: Currency;
  onChange: (currency: Currency) => void;
  className?: string;
};

/**
 * Controlled GBP/EUR/USD segmented switch.
 *
 * Presentational only, the selected currency is owned by the parent
 * (PricingSections / PricingRoi) and passed back via onChange. Implemented as an accessible
 * radiogroup: arrow keys move between options, Tab enters/leaves the group.
 */
export function CurrencyToggle({
  value,
  onChange,
  className = "",
}: CurrencyToggleProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move selection AND focus between options (ARIA radiogroup contract).
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (dir === 0) return;
    e.preventDefault();
    const idx = CURRENCIES.indexOf(value);
    const nextIdx = (idx + dir + CURRENCIES.length) % CURRENCIES.length;
    onChange(CURRENCIES[nextIdx]);
    buttonsRef.current[nextIdx]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Display currency"
      onKeyDown={handleKeyDown}
      className={
        "inline-flex items-center gap-1 border-[3px] border-ink bg-paper p-1 " +
        className
      }
    >
      {CURRENCIES.map((currency, i) => {
        const selected = currency === value;
        return (
          <button
            key={currency}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(currency)}
            className={
              "cursor-pointer px-4 py-1.5 text-sm font-bold uppercase tracking-[0.04em] transition-colors duration-150 " +
              "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink " +
              (selected
                ? "border-2 border-ink bg-brut-yellow text-ink"
                : "border-2 border-transparent text-gray-600 hover:text-ink")
            }
          >
            {currency}
          </button>
        );
      })}
    </div>
  );
}
