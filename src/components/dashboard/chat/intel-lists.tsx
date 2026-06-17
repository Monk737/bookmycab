"use client";

import { SearchableScroll } from "./searchable-scroll";
import { RankRow } from "./intel-bits";

export interface RouteRow {
  label: string;
  count: number;
  avgFare: string | null;
}

export interface CustomerRow {
  handle: string;
  bookings: number;
}

/** Searchable + scrollable Top routes leaderboard (trips + avg fare per route). */
export function TopRoutesList({ items, rangeLabel }: { items: RouteRow[]; rangeLabel: string }) {
  const max = Math.max(1, ...items.map((r) => r.count));
  return (
    <SearchableScroll
      title="Top routes"
      items={items}
      getKey={(r) => r.label}
      getSearchText={(r) => r.label}
      renderItem={(r, i) => (
        <RankRow index={i + 1} label={r.label} value={`${r.count}${r.avgFare ? ` · ${r.avgFare}` : ""}`} count={r.count} max={max} />
      )}
      searchPlaceholder="Search pickup or destination…"
      emptyLabel={`${items.length} route${items.length === 1 ? "" : "s"} · ${rangeLabel.toLowerCase()}`}
      noneLabel="No routes captured in this window yet."
    />
  );
}

/** Searchable + scrollable Repeat customers leaderboard (by WhatsApp number). */
export function RepeatCustomersList({ items }: { items: CustomerRow[] }) {
  const max = Math.max(1, ...items.map((r) => r.bookings));
  return (
    <SearchableScroll
      title="Repeat customers"
      items={items}
      getKey={(c) => c.handle}
      getSearchText={(c) => c.handle}
      renderItem={(c, i) => <RankRow index={i + 1} label={c.handle} value={`${c.bookings}`} count={c.bookings} max={max} />}
      searchPlaceholder="Search number…"
      emptyLabel={`${items.length} repeat booker${items.length === 1 ? "" : "s"}`}
      noneLabel="No repeat bookers in this window yet."
    />
  );
}
