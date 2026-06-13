import type { ReactNode, ReactElement } from "react";
import { Children, cloneElement, isValidElement } from "react";
import Link from "next/link";

/* ----------------------------------------------------------------------------
   Shared Neo-Brutalism dashboard primitives.

   Hard 3px ink frames, flat fills, hard offset shadows, sharp corners. Figures
   are mono + tabular-nums. Color is held back to status + one accent so dense
   data stays readable (the product-register rule).
   -------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   Stat colour system (shared by StatTile + admin StatCard).

   Solid fills from a strict 5-colour palette: black, white, taxi-yellow, lime
   (#c6f24e), cyan (#5fd9e8). Cards are coloured by their position in the grid
   via a fixed sequence, so the colours shuffle and no two neighbours ever share
   a colour. Each colour pins its own text colours for WCAG AA (paper text on
   ink, ink text on the lights).
   -------------------------------------------------------------------------- */

export type StatColor = "yellow" | "lime" | "cyan" | "ink" | "paper";

interface StatStyle {
  bg: string;
  label: string;
  value: string;
  sub: string;
}

export const STAT_STYLE: Record<StatColor, StatStyle> = {
  yellow: { bg: "bg-brut-yellow", label: "text-ink/70", value: "text-ink", sub: "text-ink/70" },
  lime: { bg: "bg-brut-lime", label: "text-ink/70", value: "text-ink", sub: "text-ink/70" },
  cyan: { bg: "bg-brut-cyan", label: "text-ink/70", value: "text-ink", sub: "text-ink/70" },
  ink: { bg: "bg-ink", label: "text-paper/65", value: "text-paper", sub: "text-paper/65" },
  paper: { bg: "bg-paper", label: "text-gray-600", value: "text-ink", sub: "text-gray-600" },
};

// Consecutive entries differ, so cycling by index never repeats a neighbour
// across the common 2/3/4/6-column grids.
const STAT_SEQUENCE: StatColor[] = ["yellow", "ink", "cyan", "paper", "lime"];

function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Pick a stat colour by grid index (preferred) or a stable label hash. */
export function statColor(index: number | undefined, seed: string): StatStyle {
  const i = index ?? hashIndex(seed);
  return STAT_STYLE[STAT_SEQUENCE[i % STAT_SEQUENCE.length]];
}

/** A single operational stat. Lives inside StatGrid's hairline ink bed. */
export function StatTile({
  label,
  value,
  unit,
  sub,
  index,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: ReactNode;
  /** Grid position, injected by StatGrid, drives the shuffled solid colour. */
  index?: number;
}) {
  const s = statColor(index, label);
  return (
    <div className={`flex min-w-0 flex-col ${s.bg}`}>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5">
        <p className={`text-[11px] font-bold uppercase tracking-[0.1em] ${s.label}`}>{label}</p>
        <p className={`mt-2.5 font-mono text-3xl font-bold tabular-nums leading-none ${s.value}`}>
          {value}
          {unit ? <span className={`ml-1 text-base font-semibold ${s.sub}`}>{unit}</span> : null}
        </p>
        {sub ? <div className={`mt-2 text-xs font-semibold ${s.sub}`}>{sub}</div> : null}
      </div>
    </div>
  );
}

/**
 * Injects a sequential `index` into each direct child so a row of StatTiles is
 * coloured by position (shuffled, no repeated neighbour). Only valid elements
 * advance the counter, so conditional `{cond && <StatTile/>}` children are safe.
 */
function withStatIndex(children: ReactNode): ReactNode {
  let i = 0;
  return Children.map(children, (child) =>
    isValidElement(child)
      ? cloneElement(child as ReactElement<{ index?: number }>, { index: i++ })
      : child,
  );
}

/** Lays stat tiles on a hairline ink bed so the row reads as one framed object. */
export function StatGrid({ children, cols = "sm:grid-cols-2 lg:grid-cols-3" }: { children: ReactNode; cols?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-[3px] border-[3px] border-ink bg-ink shadow-brut ${cols}`}>
      {withStatIndex(children)}
    </div>
  );
}

/** A framed content panel with a heading row and optional action link. */
export function Panel({
  title,
  badge,
  action,
  children,
  className = "",
}: {
  title: string;
  badge?: ReactNode;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col border-[3px] border-ink bg-paper shadow-brut ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b-[3px] border-ink px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">{title}</h2>
          {badge}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="brut-focus shrink-0 text-xs font-bold uppercase tracking-[0.06em] text-ink underline decoration-2 underline-offset-4 hover:bg-brut-yellow"
          >
            {action.label}
          </Link>
        ) : null}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<string, { fill: string; dot: string }> = {
  live: { fill: "bg-brut-lime text-ink", dot: "bg-ink" },
  active: { fill: "bg-brut-lime text-ink", dot: "bg-ink" },
  uat: { fill: "bg-brut-yellow text-ink", dot: "bg-ink" },
  building: { fill: "bg-brut-orange text-ink", dot: "bg-ink" },
  paused: { fill: "bg-gray-200 text-ink", dot: "bg-gray-600" },
  stopped: { fill: "bg-gray-200 text-ink", dot: "bg-gray-600" },
  error: { fill: "bg-brut-red text-ink", dot: "bg-ink" },
};

/** Status as fill + dot + label so it never rides on colour alone (CVD-safe). */
export function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { fill: "bg-gray-200 text-ink", dot: "bg-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${s.fill}`}>
      <span className={`h-2 w-2 ${s.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}

/** A brutalist segmented usage meter (used / total). Filled blocks are flat. */
export function UsageMeter({
  used,
  total,
  fill = "bg-brut-yellow",
  segments = 24,
}: {
  used: number;
  total: number;
  fill?: string;
  segments?: number;
}) {
  const pct = total > 0 ? Math.min(1, used / total) : 0;
  const filled = Math.round(pct * segments);
  return (
    <div className="flex h-5 gap-[2px] border-2 border-ink bg-paper p-[2px]" role="img" aria-label={`${used} of ${total} used`}>
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className={`h-full flex-1 ${i < filled ? fill : "bg-gray-100"}`} />
      ))}
    </div>
  );
}

/** Empty state that teaches the surface rather than saying "nothing here". */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border-[3px] border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-paper text-ink shadow-brut-sm">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-extrabold uppercase tracking-tight text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
