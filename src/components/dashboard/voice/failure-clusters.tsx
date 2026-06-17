"use client";

import type { FailureCluster } from "@/lib/voice/quality";

/* Each reason owns a flat colour; the words carry the meaning (never colour alone). */
const REASON_STYLE: Record<string, string> = {
  "System error": "bg-brut-red",
  "Caller abandoned": "bg-brut-orange",
  "Repeated address confusion": "bg-brut-violet",
  "Unusually long": "bg-brut-cyan",
  "Goal not met": "bg-brut-yellow",
};

/* A one-line note on what each flag means, shown under the reason. */
const REASON_HINT: Record<string, string> = {
  "System error": "Booking failed at the dispatch step",
  "Caller abandoned": "Hung up before finishing",
  "Repeated address confusion": "4+ address look-ups in one call",
  "Unusually long": "Handle time well over the norm",
  "Goal not met": "Agent didn't reach the call's goal",
};

/* Rising failures are bad, so up = red, down = lime. */
function DeltaChip({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null) {
    return <span className="border-2 border-ink bg-brut-orange px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">New</span>;
  }
  if (deltaPct === 0) {
    return <span className="border-2 border-ink bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">Flat</span>;
  }
  const up = deltaPct > 0;
  return (
    <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink ${up ? "bg-brut-red" : "bg-brut-lime"}`}>
      {up ? "▲" : "▼"} {Math.abs(deltaPct)}%
    </span>
  );
}

/* A flat ink-bar sparkline of per-day occurrences. */
function Sparkline({ trend, active }: { trend: { date: string; count: number }[]; active: boolean }) {
  const max = Math.max(1, ...trend.map((t) => t.count));
  return (
    <div className="flex h-8 items-end gap-px border-2 border-ink bg-paper px-1 py-0.5" aria-hidden="true">
      {trend.map((t, i) => (
        <span
          key={i}
          className={`flex-1 ${t.count ? (active ? "bg-ink" : "bg-ink") : "bg-gray-200"}`}
          style={{ height: t.count ? `${Math.max(12, (t.count / max) * 100)}%` : "2px" }}
          title={`${t.date}: ${t.count}`}
        />
      ))}
    </div>
  );
}

/**
 * Failure reasons over time — the lever for improving the agent. Groups flagged
 * calls by detected reason, charts each reason's daily trend, and flags which
 * problems are rising vs the prior window. Click a reason to drill the Call
 * Inspector below into exactly those calls.
 */
export function FailureClusters({
  clusters,
  totalFlagged,
  risingCount,
  windowLabel,
  activeReason,
  onSelectReason,
}: {
  clusters: FailureCluster[];
  totalFlagged: number;
  risingCount: number;
  windowLabel: string;
  activeReason: string | null;
  onSelectReason: (reason: string) => void;
}) {
  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-[3px] border-ink bg-brut-orange px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Failure reasons over time</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{totalFlagged}</span>
        </div>
        <p className="text-xs font-semibold text-ink/75">
          {risingCount > 0 ? `${risingCount} rising vs the prior period` : "Nothing rising"} · click a reason to see its calls
        </p>
      </header>

      {clusters.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-600">
          No flagged calls in {windowLabel}. The agent handled every call cleanly.
        </p>
      ) : (
        <ul className="divide-y-2 divide-gray-100">
          {clusters.map((c) => {
            const active = activeReason === c.reason;
            return (
              <li key={c.reason}>
                <button
                  type="button"
                  onClick={() => onSelectReason(c.reason)}
                  aria-pressed={active}
                  className={`brut-focus flex w-full items-center gap-4 px-4 py-3 text-left transition-colors ${active ? "bg-brut-yellow" : "bg-paper hover:bg-gray-50"}`}
                >
                  {/* Reason + hint */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-3 w-3 shrink-0 border-2 border-ink ${REASON_STYLE[c.reason] ?? "bg-gray-200"}`} aria-hidden="true" />
                      <span className="text-sm font-bold text-ink">{c.reason}</span>
                    </div>
                    {REASON_HINT[c.reason] ? (
                      <p className="mt-0.5 truncate text-[11px] font-medium text-gray-500">{REASON_HINT[c.reason]}</p>
                    ) : null}
                  </div>

                  {/* Sparkline */}
                  <div className="hidden w-32 shrink-0 sm:block">
                    <Sparkline trend={c.trend} active={active} />
                  </div>

                  {/* Count + delta */}
                  <div className="flex w-24 shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-xl font-extrabold tabular-nums leading-none text-ink">{c.count}</span>
                    <DeltaChip deltaPct={c.deltaPct} />
                  </div>

                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className={`h-4 w-4 shrink-0 ${active ? "text-ink" : "text-gray-300"}`} aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
