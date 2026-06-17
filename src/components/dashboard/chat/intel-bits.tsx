/** Pure presentational bits for Chat Intelligence — safe in server and client trees. */

import type { ReactNode } from "react";

/** A brutalist card with a flat colour header bar — the Intelligence card frame. */
export function IntelCard({
  title,
  accent,
  badge,
  children,
  className = "",
}: {
  title: string;
  accent: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col border-[3px] border-ink bg-paper shadow-brut ${className}`}>
      <header className={`flex items-center justify-between gap-3 border-b-[3px] border-ink px-4 py-2.5 ${accent}`}>
        <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">{title}</h3>
        {badge}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** A bold colour ribbon used as a section divider. */
export function SectionRibbon({ title, sub, color }: { title: string; sub?: string; color: string }) {
  return (
    <div className="mb-4 mt-9 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className={`inline-block -rotate-1 border-[3px] border-ink ${color} px-3 py-1 font-display text-sm font-extrabold uppercase tracking-[0.08em] text-ink shadow-brut-sm`}>
        {title}
      </span>
      {sub ? <span className="text-xs font-medium text-gray-500">{sub}</span> : null}
    </div>
  );
}

/** A horizontal proportion bar with a label and a value. */
export function Bar({ label, value, count, max, fill }: { label: string; value: string; count: number; max: number; fill: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{label}</p>
        <span className="mt-1 block h-2.5 border-2 border-ink bg-paper">
          <span className={`block h-full ${fill}`} style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
        </span>
      </div>
      <span className="shrink-0 text-right font-mono text-xs font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/** A fixed (non-searchable) bar list inside a Panel. */
export function BarList({ rows, fill, emptyLabel }: { rows: { key: string; label: string; value: string; count: number }[]; fill: string; emptyLabel: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-600">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <Bar label={r.label} value={r.value} count={r.count} max={max} fill={fill} />
        </li>
      ))}
    </ul>
  );
}
