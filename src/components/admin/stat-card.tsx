import type { ReactNode } from "react";

/**
 * KPI stat block: a small label over a prominent value, with optional
 * sub-text. Brutalist, ink-framed paper block on a hard offset shadow.
 */
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="border-[3px] border-ink bg-paper px-4 py-3 shadow-brut-sm">
      <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-600">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {sub != null && <p className="mt-0.5 text-xs font-medium text-gray-500">{sub}</p>}
    </div>
  );
}
