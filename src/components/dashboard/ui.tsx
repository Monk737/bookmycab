import type { ReactNode } from "react";
import Link from "next/link";

/* ----------------------------------------------------------------------------
   Shared Neo-Brutalism dashboard primitives.

   Hard 3px ink frames, flat fills, hard offset shadows, sharp corners. Figures
   are mono + tabular-nums. Color is held back to status + one accent so dense
   data stays readable (the product-register rule).
   -------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   Stat accent system (shared by StatTile + admin StatCard).

   Each stat gets a category colour: a soft tint wash on the card (soothing) plus
   a saturated ink-framed chip + strip (lively). Tailwind only emits classes it
   sees literally, so every tint/solid is written out here. When no accent is
   given we hash the label to a stable colour so a grid still reads varied and
   colourful without per-call-site wiring. All brut colours take dark ink text,
   so the washes stay WCAG AA.
   -------------------------------------------------------------------------- */

export type StatAccent = "yellow" | "lime" | "cyan" | "violet" | "pink" | "orange" | "neutral";

export const STAT_ACCENT: Record<StatAccent, { tint: string; solid: string }> = {
  yellow: { tint: "bg-brut-yellow/20", solid: "bg-brut-yellow" },
  lime: { tint: "bg-brut-lime/25", solid: "bg-brut-lime" },
  cyan: { tint: "bg-brut-cyan/20", solid: "bg-brut-cyan" },
  violet: { tint: "bg-brut-violet/20", solid: "bg-brut-violet" },
  pink: { tint: "bg-brut-pink/20", solid: "bg-brut-pink" },
  orange: { tint: "bg-brut-orange/20", solid: "bg-brut-orange" },
  neutral: { tint: "bg-canvas", solid: "bg-gray-300" },
};

const HASH_PALETTE: StatAccent[] = ["cyan", "lime", "violet", "pink", "orange", "yellow"];

function hashAccent(seed: string): StatAccent {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HASH_PALETTE[h % HASH_PALETTE.length];
}

/**
 * Resolve a stat colour. Accepts a colour name ("cyan"), the legacy bg-class
 * form ("bg-brut-cyan", incl. the no-token "bg-brut-blue" alias → cyan), or
 * nothing (hash the seed to a stable colour).
 */
export function resolveStatAccent(accent: string | undefined, seed: string): { tint: string; solid: string } {
  if (!accent || accent === "bg-paper") return STAT_ACCENT[hashAccent(seed)];
  const name = accent.replace("bg-brut-", "").replace("bg-", "");
  const key = (name === "blue" ? "cyan" : name) as StatAccent;
  return STAT_ACCENT[key] ?? STAT_ACCENT[hashAccent(seed)];
}

/** A single operational stat. Lives inside StatGrid's hairline ink bed. */
export function StatTile({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: ReactNode;
  /** Category colour: a name ("cyan") or legacy bg-class. Omit to auto-colour. */
  accent?: string;
}) {
  const a = resolveStatAccent(accent, label);
  return (
    <div className="flex min-w-0 flex-col bg-paper">
      <div className={`h-1.5 ${a.solid}`} aria-hidden="true" />
      <div className={`flex flex-1 flex-col px-4 py-4 sm:px-5 ${a.tint}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-700">{label}</p>
          <span className={`h-3 w-3 shrink-0 border-2 border-ink ${a.solid}`} aria-hidden="true" />
        </div>
        <p className="mt-2.5 font-mono text-3xl font-bold tabular-nums leading-none text-ink">
          {value}
          {unit ? <span className="ml-1 text-base font-semibold text-gray-600">{unit}</span> : null}
        </p>
        {sub ? <div className="mt-2 text-xs font-medium text-gray-700">{sub}</div> : null}
      </div>
    </div>
  );
}

/** Lays stat tiles on a hairline ink bed so the row reads as one framed object. */
export function StatGrid({ children, cols = "sm:grid-cols-2 lg:grid-cols-3" }: { children: ReactNode; cols?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-[3px] border-[3px] border-ink bg-ink shadow-brut ${cols}`}>{children}</div>
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
