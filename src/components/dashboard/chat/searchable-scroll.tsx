"use client";

import { useMemo, useState, type ReactNode } from "react";

/**
 * A titled panel with a keyword search box and a fixed-height scroll body.
 * Lighter than the LogShell (no date filter) — for aggregated lists like routes
 * or repeat customers that can grow long. Matches the brutalist panel frame.
 */
export function SearchableScroll<T>({
  title,
  items,
  getSearchText,
  renderItem,
  getKey,
  searchPlaceholder,
  emptyLabel,
  noneLabel,
  bodyHeight = "h-80",
  accent,
}: {
  title: string;
  items: T[];
  getSearchText: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  searchPlaceholder: string;
  emptyLabel: string;
  noneLabel: string;
  bodyHeight?: string;
  accent?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => getSearchText(it).toLowerCase().includes(q)) : items),
    [items, q, getSearchText],
  );
  const hasAny = items.length > 0;

  return (
    <section className="flex flex-col border-[3px] border-ink bg-paper shadow-brut">
      <header className={`border-b-[3px] border-ink px-4 py-3 ${accent ?? ""}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">{title}</h3>
          <span className="shrink-0 border-2 border-ink bg-paper px-1.5 font-mono text-[11px] font-bold tabular-nums text-ink">
            {q ? `${filtered.length}/${items.length}` : items.length}
          </span>
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
          {q ? (
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
      <div className={`scrollbar-ink ${bodyHeight} overflow-y-auto px-4`}>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-600">
            {!hasAny ? noneLabel : `No matches for “${query.trim()}”.`}
          </p>
        ) : (
          <ul className="divide-y-2 divide-gray-100">
            {filtered.map((it, i) => (
              <li key={getKey(it, i)} className="py-2.5 first:pt-3 last:pb-3">
                {renderItem(it, i)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!hasAny ? null : (
        <footer className="border-t-2 border-gray-100 px-4 py-2">
          <p className="text-[11px] font-medium text-gray-500">{emptyLabel}</p>
        </footer>
      )}
    </section>
  );
}
