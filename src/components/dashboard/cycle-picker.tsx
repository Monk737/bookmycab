"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { listCycles, currentCycleKey } from "@/lib/dashboard/billing-cycle";

/**
 * Billing-cycle selector. Writes `?cycle=YYYY-MM` to the URL (cleared back to the
 * current cycle) so the window is refresh-safe and shareable; the server page
 * reads it and re-scopes every figure to that month. The current cycle is the
 * default and carries a live dot.
 */
export function CyclePicker({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const cycles = listCycles(12);
  const current = currentCycleKey();
  const isCurrent = active === current;

  function onChange(key: string) {
    const next = new URLSearchParams(params);
    if (key === current) next.delete("cycle");
    else next.set("cycle", key);
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <label className={`inline-flex items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      <span className="hidden text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 sm:inline">Billing cycle</span>
      <span className="relative inline-flex items-center">
        <span
          aria-hidden="true"
          className={`absolute left-2.5 h-2 w-2 ${isCurrent ? "bg-brut-lime" : "bg-gray-300"} border border-ink`}
        />
        <select
          value={active}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Billing cycle"
          className="brut-focus h-9 cursor-pointer appearance-none border-[3px] border-ink bg-paper pl-6 pr-8 font-mono text-xs font-bold tabular-nums text-ink shadow-brut-sm hover:bg-brut-yellow"
        >
          {cycles.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
              {c.isCurrent ? " · current" : ""}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="square"
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}
