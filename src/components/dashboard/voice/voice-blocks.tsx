import type { VoiceStatBlock } from "@/lib/dashboard/product-overview";
import { formatDuration } from "@/lib/dashboard/product-overview";

/* Per-outcome flat fill. Colour pairs with the label + count, never alone. */
const OUTCOME_FILL: Record<string, string> = {
  booked: "bg-brut-lime",
  modified: "bg-brut-violet",
  cancelled: "bg-brut-pink",
  quoted: "bg-brut-cyan",
  transferred: "bg-brut-blue",
  abandoned: "bg-brut-orange",
  failed: "bg-brut-red",
  no_credit: "bg-brut-red-deep",
  unknown: "bg-gray-300",
};

/** Ranked outcome breakdown as flat brutalist proportion bars. */
export function OutcomeBars({ block }: { block: VoiceStatBlock }) {
  const max = Math.max(1, ...block.outcomes.map((o) => o.count));
  if (block.outcomes.length === 0) {
    return <p className="text-sm text-gray-600">No call outcomes in this window yet.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {block.outcomes.map((o) => (
        <li key={o.outcome} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink">{o.label}</span>
          <span className="h-4 border-2 border-ink bg-paper">
            <span className={`block h-full ${OUTCOME_FILL[o.outcome] ?? "bg-gray-300"}`} style={{ width: `${Math.max(6, (o.count / max) * 100)}%` }} />
          </span>
          <span className="text-right font-mono text-sm font-bold tabular-nums text-ink">{o.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where the charged calls were drawn from: plan pool vs prepaid top-up. */
export function CreditSplit({ block }: { block: VoiceStatBlock }) {
  const { plan, topup, none } = block.creditSplit;
  const total = plan + topup + none;
  const seg = [
    { key: "plan", label: "Plan", value: plan, fill: "bg-brut-yellow" },
    { key: "topup", label: "Top-up", value: topup, fill: "bg-brut-pink" },
    { key: "none", label: "No credit", value: none, fill: "bg-gray-300" },
  ];
  return (
    <div>
      <div className="flex h-6 border-2 border-ink bg-paper" role="img" aria-label="Calls by credit source">
        {total === 0 ? (
          <div className="flex-1 bg-gray-100" />
        ) : (
          seg.filter((s) => s.value > 0).map((s, i) => (
            <div key={s.key} className={`${s.fill} ${i > 0 ? "border-l-2 border-ink" : ""}`} style={{ width: `${(s.value / total) * 100}%` }} />
          ))
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {seg.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={`h-3 w-3 border-2 border-ink ${s.fill}`} aria-hidden="true" />
            <span className="text-xs font-semibold text-gray-700">
              {s.label} <span className="font-mono font-bold tabular-nums text-ink">{s.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Three compact figures for an aggregate or per-agent block. */
export function MiniStats({ block }: { block: VoiceStatBlock }) {
  const items = [
    { label: "Calls", value: block.totalCalls.toLocaleString("en-GB"), fill: "bg-brut-cyan" },
    { label: "Booked", value: `${block.bookedPct}%`, fill: "bg-brut-yellow" },
    { label: "Avg length", value: formatDuration(block.avgDurationS), fill: "bg-brut-lime" },
  ];
  return (
    <div className="grid grid-cols-3 gap-[3px] border-2 border-ink bg-ink">
      {items.map((it) => (
        <div key={it.label} className={`px-3 py-2.5 ${it.fill}`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/70">{it.label}</p>
          <p className="mt-0.5 font-mono text-lg font-bold tabular-nums leading-none text-ink">{it.value}</p>
        </div>
      ))}
    </div>
  );
}
