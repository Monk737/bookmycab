"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const PILLS: { value: string; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const todayKey = () => new Date().toLocaleDateString("en-CA");

/**
 * Analysis-window control for Chat Intelligence: quick presets (7 / 30 / 90 days)
 * plus a custom from–to calendar range. Drives the page via search params so the
 * server re-queries; the active preset reads back from the resolved window.
 */
export function IntelRangePicker({
  preset,
  from,
  to,
}: {
  preset: string;
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cFrom, setCFrom] = useState(from ?? "");
  const [cTo, setCTo] = useState(to ?? "");

  const isCustom = preset === "custom";
  const applyPreset = (days: string) => router.push(`${pathname}?days=${days}`);
  const applyCustom = () => {
    if (!cFrom || !cTo || cFrom > cTo) return;
    router.push(`${pathname}?from=${cFrom}&to=${cTo}`);
  };

  const pill = (active: boolean) =>
    `brut-press brut-focus h-9 border-[3px] border-ink px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink transition-colors ${
      active ? "bg-brut-yellow shadow-brut-sm" : "bg-paper hover:bg-canvas"
    }`;
  const dateInput =
    "brut-focus h-9 border-[3px] border-ink bg-paper px-2 font-mono text-xs font-bold text-ink";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        {PILLS.map((p) => (
          <button key={p.value} type="button" onClick={() => applyPreset(p.value)} className={pill(!isCustom && preset === p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      <span aria-hidden="true" className="hidden h-5 w-px bg-gray-300 sm:block" />
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label="From date"
          value={cFrom}
          max={cTo || todayKey()}
          onChange={(e) => setCFrom(e.target.value)}
          className={dateInput}
        />
        <span aria-hidden="true" className="text-xs font-bold text-gray-500">→</span>
        <input
          type="date"
          aria-label="To date"
          value={cTo}
          min={cFrom || undefined}
          max={todayKey()}
          onChange={(e) => setCTo(e.target.value)}
          className={dateInput}
        />
        <button
          type="button"
          onClick={applyCustom}
          disabled={!cFrom || !cTo || cFrom > cTo}
          className={`${pill(isCustom)} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
