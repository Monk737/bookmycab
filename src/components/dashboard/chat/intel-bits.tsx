/** Chat Intelligence viz primitives — Neo-Brutalism, restrained colour.
 *  Ink/grey marks carry the data; one taxi-yellow accent marks the peak; status
 *  colours are reserved for deltas. Safe in server and client trees. */

import type { ReactNode } from "react";

/** A clean section divider: display heading on a hard rule, with optional note. */
export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4 mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-[3px] border-ink pb-2">
      <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">{title}</h2>
      {sub ? <p className="text-xs font-medium text-gray-500">{sub}</p> : null}
    </div>
  );
}

/** A ranked leaderboard row: index, label, thin proportional bar, value. */
export function RankRow({
  index,
  label,
  value,
  count,
  max,
}: {
  index: number;
  label: string;
  value: string;
  count: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-gray-400">{index}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold text-ink">{label}</p>
          <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-ink">{value}</span>
        </div>
        <span className="mt-1.5 block h-1.5 bg-gray-100">
          <span className="block h-full bg-ink" style={{ width: `${Math.max(3, (count / max) * 100)}%` }} />
        </span>
      </div>
    </div>
  );
}

/** A vertical column chart. The tallest column is the one yellow accent. */
export function ColumnChart({
  bars,
  tickEvery = 1,
  showValues = false,
  height = "h-40",
}: {
  bars: { label: string; value: number }[];
  tickEvery?: number;
  showValues?: boolean;
  height?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.reduce((m, b, i, a) => (b.value > a[m].value ? i : m), 0);
  return (
    <div>
      <div className={`flex ${height} items-end gap-[3px]`}>
        {bars.map((b, i) => {
          const fill = b.value === 0 ? "bg-gray-100" : i === peak ? "bg-brut-yellow" : "bg-ink";
          return (
            <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${b.value}`}>
              {showValues && b.value ? (
                <span className="mb-1 text-center font-mono text-[10px] font-bold tabular-nums text-gray-500">{b.value}</span>
              ) : null}
              <span className={`w-full border-2 border-ink ${fill}`} style={{ height: b.value ? `${Math.max(5, (b.value / max) * 100)}%` : "3px" }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t-2 border-ink pt-1.5">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 truncate text-center font-mono text-[9px] font-bold uppercase tabular-nums text-gray-500">
            {i % tickEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// Grey ramp + one accent — a composition that reads without relying on hue.
const SEGMENT_RAMP = ["bg-brut-yellow", "bg-ink", "bg-gray-500", "bg-gray-400", "bg-gray-300", "bg-gray-200"];

/** A 100% composition bar with a legend (used for vehicle mix). */
export function SegmentBar({ rows, emptyLabel }: { rows: { label: string; count: number; pct: number }[]; emptyLabel: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-600">{emptyLabel}</p>;
  return (
    <div>
      <div className="flex h-7 overflow-hidden border-2 border-ink" role="img" aria-label="Vehicle composition">
        {rows.map((r, i) => (
          <span
            key={r.label}
            className={`${SEGMENT_RAMP[i] ?? "bg-gray-200"} ${i > 0 ? "border-l-2 border-ink" : ""}`}
            style={{ width: `${Math.max(2, r.pct)}%` }}
            title={`${r.label}: ${r.pct}%`}
          />
        ))}
      </div>
      <ul className="mt-3.5 space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2.5">
            <span className={`h-3 w-3 shrink-0 border-2 border-ink ${SEGMENT_RAMP[i] ?? "bg-gray-200"}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{r.label}</span>
            <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-ink">
              {r.count} <span className="text-gray-400">·</span> {r.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A pair of figures on a hairline ink bed (ASAP vs scheduled, etc.). */
export function SplitStat({ a, b }: { a: { label: string; value: ReactNode }; b: { label: string; value: ReactNode } }) {
  return (
    <div className="grid grid-cols-2 gap-[2px] border-2 border-ink bg-ink">
      {[a, b].map((x, i) => (
        <div key={i} className="bg-paper px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500">{x.label}</p>
          <p className="mt-1 font-mono text-lg font-extrabold tabular-nums leading-none text-ink">{x.value}</p>
        </div>
      ))}
    </div>
  );
}

/** A single framed figure block. */
export function MetricBlock({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="border-2 border-ink p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums leading-none text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-600">{sub}</p> : null}
    </div>
  );
}
