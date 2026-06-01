import type { ReactNode } from "react";

/**
 * KPI strip card: a small label over a prominent value, with optional
 * sub-text. Matches the operational console aesthetic — white card on the
 * zinc-100 canvas, dense, neutral.
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
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
        {value}
      </p>
      {sub != null && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
