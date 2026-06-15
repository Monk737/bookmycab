"use client";

import { useMemo, useState, type ReactNode } from "react";
import { fmtDayLabel, todayKey } from "@/lib/voice/format";

/**
 * Reusable log panel: searchable, date-filtered, scrollable. Two modes:
 *
 * - Browse (default): opens on today; a calendar plus prev/next pick a day.
 *   Used by Recent calls / Bookings.
 * - All-by-default (`allByDefault`): opens showing every item, ordered by
 *   `sortAll` (e.g. severity for a triage queue); the calendar becomes an
 *   optional day filter and an "All" pill returns to the full list.
 *
 * Typing in the search box matches any keyword across the whole window (the date
 * filter is ignored while searching). Entries are never removed. Generic.
 */
export function LogShell<T>({
  title,
  items,
  getDate,
  getKey,
  getSearchText,
  renderItem,
  emptyLabel,
  noneLabel,
  searchPlaceholder,
  allByDefault = false,
  windowLabel = "last 90 days",
  sortAll,
  badge,
}: {
  title: string;
  items: T[];
  /** YYYY-MM-DD (local) for an item. */
  getDate: (item: T) => string;
  getKey: (item: T) => string;
  /** Concatenated searchable text for an item. */
  getSearchText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyLabel: string;
  noneLabel: string;
  searchPlaceholder: string;
  /** Open showing all items (ordered by `sortAll`) instead of today. */
  allByDefault?: boolean;
  /** Footer window label, e.g. "this cycle" or "last 90 days". */
  windowLabel?: string;
  /** Ordering for the "all" + search views (e.g. by severity). */
  sortAll?: (a: T, b: T) => number;
  /** Optional header chip rendered next to the title (e.g. a count). */
  badge?: ReactNode;
}) {
  // "" means the All view (only reachable when allByDefault).
  const [day, setDay] = useState<string>(allByDefault ? "" : todayKey());
  const [query, setQuery] = useState<string>("");

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const showingAll = !searching && day === "";

  const { filtered, daysWithData } = useMemo(() => {
    const set = new Set<string>();
    let f: T[] = [];
    for (const it of items) {
      set.add(getDate(it));
      if (searching) {
        if (getSearchText(it).toLowerCase().includes(q)) f.push(it);
      } else if (day === "") {
        f.push(it);
      } else if (getDate(it) === day) {
        f.push(it);
      }
    }
    if ((searching || day === "") && sortAll) f = [...f].sort(sortAll);
    return { filtered: f, daysWithData: set };
  }, [items, day, q, searching, getDate, getSearchText, sortAll]);

  function shiftDay(delta: number) {
    const base = day || todayKey();
    const d = new Date(`${base}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setDay(d.toLocaleDateString("en-CA"));
  }

  const isToday = day === todayKey();
  const hasAny = items.length > 0;
  const headerSub = searching ? "Search" : showingAll ? "All" : fmtDayLabel(day);

  return (
    <section className="flex flex-col border-[3px] border-ink bg-paper shadow-brut">
      <header className="border-b-[3px] border-ink px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0">
              <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">{title}</h3>
              <p className="font-mono text-[11px] font-bold text-gray-500">{headerSub}</p>
            </div>
            {badge}
          </div>
          <div className={`flex items-center gap-1.5 ${searching ? "opacity-40" : ""}`}>
            {allByDefault ? (
              <button
                type="button"
                onClick={() => setDay("")}
                disabled={searching || showingAll}
                className={`brut-press brut-focus h-8 border-2 border-ink px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink disabled:opacity-40 ${showingAll ? "bg-brut-yellow" : "bg-paper"}`}
              >
                All
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => shiftDay(-1)}
              disabled={searching}
              className="brut-press brut-focus flex h-8 w-8 items-center justify-center border-2 border-ink bg-paper text-sm font-bold text-ink disabled:cursor-not-allowed"
            >
              &larr;
            </button>
            <input
              type="date"
              value={day}
              max={todayKey()}
              disabled={searching}
              onChange={(e) => setDay(e.target.value || (allByDefault ? "" : todayKey()))}
              aria-label="Pick a day"
              className="brut-focus h-8 border-2 border-ink bg-paper px-2 font-mono text-xs font-bold text-ink disabled:cursor-not-allowed"
            />
            <button
              type="button"
              aria-label="Next day"
              onClick={() => shiftDay(1)}
              disabled={searching || showingAll || isToday}
              className="brut-press brut-focus flex h-8 w-8 items-center justify-center border-2 border-ink bg-paper text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              &rarr;
            </button>
            {!allByDefault ? (
              <button
                type="button"
                onClick={() => setDay(todayKey())}
                disabled={searching || isToday}
                className="brut-press brut-focus h-8 border-2 border-ink bg-brut-yellow px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink disabled:opacity-40"
              >
                Today
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative mt-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${title}`}
            className="brut-focus h-9 w-full border-2 border-ink bg-paper pl-9 pr-8 text-sm text-ink placeholder:text-gray-400"
          />
          {searching ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="brut-focus absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-sm font-bold text-gray-500 hover:text-ink"
            >
              &times;
            </button>
          ) : null}
        </div>
      </header>

      <div className="scrollbar-ink h-96 overflow-y-auto px-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">
            {!hasAny ? noneLabel : searching ? `No matches for “${query.trim()}”.` : emptyLabel}
          </p>
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
          {searching
            ? `${filtered.length} match${filtered.length === 1 ? "" : "es"} · ${windowLabel}`
            : showingAll
              ? `${filtered.length} total · ${windowLabel}`
              : `${filtered.length} on this day · ${items.length} in ${windowLabel}`}
        </p>
        {!searching && !showingAll && daysWithData.size > 1 ? (
          <p className="text-[11px] font-medium text-gray-400">{daysWithData.size} active days</p>
        ) : null}
      </footer>
    </section>
  );
}
