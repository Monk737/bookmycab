"use client";

import { useMemo, useState, type ReactNode } from "react";
import { fmtDayLabel, todayKey } from "@/lib/voice/format";

/**
 * Reusable log panel: a date-filtered, scrollable list. Defaults to today; a
 * calendar input plus prev/next arrows move to other days. Older entries are not
 * removed, they live under their own date. Generic over the row type.
 */
export function LogShell<T>({
  title,
  items,
  getDate,
  getKey,
  renderItem,
  emptyLabel,
  noneLabel,
}: {
  title: string;
  items: T[];
  /** YYYY-MM-DD (local) for an item. */
  getDate: (item: T) => string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Shown when there are entries overall, but none on the chosen day. */
  emptyLabel: string;
  /** Shown when there are no entries at all in the window. */
  noneLabel: string;
}) {
  const [day, setDay] = useState<string>(todayKey());

  const { filtered, daysWithData } = useMemo(() => {
    const set = new Set<string>();
    const f: T[] = [];
    for (const it of items) {
      const d = getDate(it);
      set.add(d);
      if (d === day) f.push(it);
    }
    return { filtered: f, daysWithData: set };
  }, [items, day, getDate]);

  function shiftDay(delta: number) {
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDay(d.toLocaleDateString("en-CA"));
  }

  const isToday = day === todayKey();
  const hasAny = items.length > 0;

  return (
    <section className="flex h-full flex-col border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-[3px] border-ink px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">{title}</h3>
          <p className="font-mono text-[11px] font-bold text-gray-500">{fmtDayLabel(day)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => shiftDay(-1)}
            className="brut-press brut-focus flex h-8 w-8 items-center justify-center border-2 border-ink bg-paper text-sm font-bold text-ink"
          >
            &larr;
          </button>
          <input
            type="date"
            value={day}
            max={todayKey()}
            onChange={(e) => setDay(e.target.value || todayKey())}
            aria-label="Pick a day"
            className="brut-focus h-8 border-2 border-ink bg-paper px-2 font-mono text-xs font-bold text-ink"
          />
          <button
            type="button"
            aria-label="Next day"
            onClick={() => shiftDay(1)}
            disabled={isToday}
            className="brut-press brut-focus flex h-8 w-8 items-center justify-center border-2 border-ink bg-paper text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            &rarr;
          </button>
          <button
            type="button"
            onClick={() => setDay(todayKey())}
            disabled={isToday}
            className="brut-press brut-focus h-8 border-2 border-ink bg-brut-yellow px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink disabled:opacity-40"
          >
            Today
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">{hasAny ? emptyLabel : noneLabel}</p>
        ) : (
          <ul className="divide-y-2 divide-gray-100">
            {filtered.map((it) => (
              <li key={getKey(it)} className="py-3 first:pt-3 last:pb-3">
                {renderItem(it)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-between border-t-2 border-gray-100 px-4 py-2">
        <p className="text-[11px] font-medium text-gray-500">
          {filtered.length} on this day · {items.length} in last 90 days
        </p>
        {daysWithData.size > 1 ? (
          <p className="text-[11px] font-medium text-gray-400">{daysWithData.size} active days</p>
        ) : null}
      </footer>
    </section>
  );
}
