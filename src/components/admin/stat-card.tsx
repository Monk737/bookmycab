import type { ReactNode, ReactElement } from "react";
import { Children, cloneElement, isValidElement } from "react";
import { statColor } from "@/components/dashboard/ui";

/**
 * KPI stat block: a small label over a prominent value, with optional sub-text.
 * Brutalist ink-framed card with a solid fill from the strict 5-colour palette
 * (black / white / yellow / lime / cyan). The colour comes from the card's grid
 * position via StatCardGrid, so colours shuffle and no two neighbours match.
 */
export function StatCard({
  label,
  value,
  sub,
  index,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Grid position, injected by StatCardGrid, drives the shuffled solid colour. */
  index?: number;
}) {
  const s = statColor(index, label);
  return (
    <div className={`border-[3px] border-ink ${s.bg} px-4 py-3 shadow-brut-sm`}>
      <p className={`font-mono text-[11px] font-bold uppercase tracking-wider ${s.label}`}>{label}</p>
      <p className={`mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight ${s.value}`}>{value}</p>
      {sub != null && <p className={`mt-0.5 text-xs font-semibold ${s.sub}`}>{sub}</p>}
    </div>
  );
}

/**
 * Grid wrapper that injects a sequential `index` into each StatCard so a row is
 * coloured by position (shuffled, no repeated neighbour). `gap-3` + `grid` are
 * baked in; pass cols/margins via `className`.
 */
export function StatCardGrid({ className = "", children }: { className?: string; children: ReactNode }) {
  let i = 0;
  return (
    <div className={`grid gap-3 ${className}`}>
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<{ index?: number }>, { index: i++ })
          : child,
      )}
    </div>
  );
}
