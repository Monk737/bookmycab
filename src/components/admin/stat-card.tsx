import type { ReactNode } from "react";
import { resolveStatAccent } from "@/components/dashboard/ui";

/**
 * KPI stat block: a small label over a prominent value, with optional sub-text.
 * Brutalist ink-framed card on a hard offset shadow, with a soft category tint
 * (soothing) and a saturated ink-framed chip (lively). Colour is auto-derived
 * from the label when no `accent` is given, so an admin grid reads varied and
 * colourful without per-card wiring. Brut washes keep dark ink text WCAG AA.
 */
export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Category colour name ("cyan") or legacy bg-class. Omit to auto-colour. */
  accent?: string;
}) {
  const a = resolveStatAccent(accent, label);
  return (
    <div className={`border-[3px] border-ink ${a.solid} px-4 py-3 shadow-brut-sm`}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink/70">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {sub != null && <p className="mt-0.5 text-xs font-semibold text-ink/70">{sub}</p>}
    </div>
  );
}
