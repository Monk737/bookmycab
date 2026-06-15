"use client";

import { useMemo, useState } from "react";
import type { RouteItem, AirportItem } from "@/lib/voice/intelligence";

const AIRPORT_NAME: Record<string, string> = {
  LHR: "Heathrow", LGW: "Gatwick", STN: "Stansted", LTN: "Luton", LCY: "London City",
};

/** Compact search box matching the log panels (ink frame, magnifier). */
function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={`Search ${label}`}
        className="brut-focus h-8 w-full border-2 border-ink bg-paper pl-8 pr-7 text-xs text-ink placeholder:text-gray-400"
      />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="brut-focus absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-sm font-bold text-gray-500 hover:text-ink">
          &times;
        </button>
      ) : null}
    </div>
  );
}

/** Top routes — searchable + scrollable over the full window list. Fixed height keeps the panel size steady. */
export function RouteList({ routes }: { routes: RouteItem[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => (query ? routes.filter((r) => r.label.toLowerCase().includes(query)) : routes), [routes, query]);

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Top routes</p>
        <span className="font-mono text-[11px] font-bold tabular-nums text-gray-400">{routes.length}</span>
      </div>
      {routes.length === 0 ? (
        <p className="text-sm text-gray-500">No routes captured yet.</p>
      ) : (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Search routes…" label="routes" />
          <div className="scrollbar-ink mt-2 h-64 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No routes match “{q.trim()}”.</p>
            ) : (
              <ol className="space-y-2.5">
                {filtered.map((r, i) => (
                  <li key={r.label} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 font-mono text-xs font-bold tabular-nums text-gray-400">{query ? "·" : i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.label}</span>
                    <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-ink">
                      {r.count}
                      {r.revenue > 0 ? <span className="text-gray-500"> · £{r.revenue}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Airport runs — searchable (code or name) + scrollable. */
export function AirportList({ airports }: { airports: AirportItem[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? airports.filter((a) => a.code.toLowerCase().includes(query) || (AIRPORT_NAME[a.code] ?? "").toLowerCase().includes(query)) : airports),
    [airports, query],
  );

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Airport runs</p>
        <span className="font-mono text-[11px] font-bold tabular-nums text-gray-400">{airports.length}</span>
      </div>
      {airports.length === 0 ? (
        <p className="text-sm text-gray-500">None yet.</p>
      ) : (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Search airports…" label="airports" />
          <div className="scrollbar-ink mt-2 h-64 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No airports match “{q.trim()}”.</p>
            ) : (
              <ul className="space-y-2.5">
                {filtered.map((a) => (
                  <li key={a.code} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="border-2 border-ink bg-brut-cyan px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">{a.code}</span>
                      <span className="text-sm text-ink">{AIRPORT_NAME[a.code] ?? a.code}</span>
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-ink">{a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
