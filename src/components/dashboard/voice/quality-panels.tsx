import { Panel, StatGrid, StatTile } from "@/components/dashboard/ui";
import { formatDuration } from "@/lib/dashboard/product-overview";
import { HandleTrend } from "./handle-trend";
import type { AgentPerformance, SentimentData, LoyaltyData } from "@/lib/voice/quality";

/* ------------------------------------------------------------------- helpers */

function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* --------------------------------------------------------------- Performance */

/** Headline agent KPIs on the shared hairline-ink stat bed. */
export function PerformanceKpis({ p }: { p: AgentPerformance }) {
  return (
    <StatGrid cols="grid-cols-2 lg:grid-cols-4">
      <StatTile label="Containment" value={`${p.containmentPct}%`} sub={`${p.transferred} sent to a human`} />
      <StatTile
        label="Success rate"
        value={`${p.successPct}%`}
        sub={p.successSample ? `${p.successSample} call${p.successSample === 1 ? "" : "s"} scored` : "none scored"}
      />
      <StatTile label="Avg handle time" value={formatDuration(p.avgHandleS)} sub="per call" />
      <StatTile label="Calls" value={p.totalCalls.toLocaleString("en-GB")} sub="this window" />
    </StatGrid>
  );
}

/** The avg handle-time trend, wrapped in a framed panel. */
export function HandleTrendPanel({ p }: { p: AgentPerformance }) {
  return (
    <Panel title="Avg handle time" className="lg:col-span-2">
      <HandleTrend data={p.handleTrend} />
      <p className="mt-3 max-w-prose text-xs text-gray-600">
        Mean call length per day across the selected cycle. A steady climb usually means the agent is repeating itself,
        asking for the same detail twice, or stuck re-confirming an address.
      </p>
    </Panel>
  );
}

/**
 * Operational health: surfaces failure clusters (a burst of failed calls in one
 * hour) so an upstream outage like a model-quota error is caught at a glance,
 * not buried in the log.
 */
export function OperationalHealth({ p }: { p: AgentPerformance }) {
  return (
    <Panel title="Operational health">
      {p.failClusters.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 border-2 border-ink bg-brut-red px-3 py-2">
            <span className="font-mono text-2xl font-extrabold tabular-nums leading-none text-ink">{p.failedTotal}</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink">
              failed call{p.failedTotal === 1 ? "" : "s"} · incident detected
            </span>
          </div>
          <ul>
            {p.failClusters.map((c) => (
              <li key={c.when} className="flex items-center justify-between gap-3 border-b-2 border-gray-100 py-1.5 text-sm last:border-b-0">
                <span className="text-ink">{c.when}</span>
                <span className="font-mono text-sm font-bold tabular-nums text-ink">{c.count} failed</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-600">
            Several failures in one hour points at an upstream outage (model quota, dispatch API), not the agent. Worth a
            quick check with your build team.
          </p>
        </div>
      ) : p.failedTotal > 0 ? (
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-2.5 border-2 border-ink bg-brut-orange px-3 py-2">
            <span className="font-mono text-2xl font-extrabold tabular-nums leading-none text-ink">{p.failedTotal}</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink">failed · scattered</span>
          </div>
          <p className="text-sm text-gray-600">A handful of failures, none clustered into an incident. No action needed unless it climbs.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-2 border-2 border-ink bg-brut-lime px-3 py-2">
            <span className="h-2.5 w-2.5 bg-ink" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink">All clear</span>
          </div>
          <p className="text-sm text-gray-600">No system failures in this window. Every call reached the agent.</p>
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------------------- Sentiment */

const SENT_SEG = [
  { key: "positive", label: "Positive", fill: "bg-brut-lime" },
  { key: "neutral", label: "Neutral", fill: "bg-gray-200" },
  { key: "negative", label: "Negative", fill: "bg-brut-red" },
] as const;

/** Caller satisfaction: positive share, the split, and a 14-day stacked trend. */
export function SentimentPanel({ s }: { s: SentimentData }) {
  const total = s.sampled;
  const satisfaction = total ? Math.round((s.positive / total) * 100) : 0;
  const counts: Record<string, number> = { positive: s.positive, neutral: s.neutral, negative: s.negative };
  const tMax = Math.max(1, ...s.trend.map((d) => d.positive + d.neutral + d.negative));

  return (
    <Panel title="Caller sentiment">
      {total === 0 ? (
        <p className="text-sm text-gray-600">No sentiment scored yet. Once calls are analysed, satisfaction and its day-by-day trend land here.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-4xl font-extrabold tabular-nums leading-none text-ink">{satisfaction}%</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
              Positive · {total} call{total === 1 ? "" : "s"} scored
            </p>
          </div>

          <div className="flex h-6 border-2 border-ink bg-paper" role="img" aria-label={`Sentiment: ${s.positive} positive, ${s.neutral} neutral, ${s.negative} negative`}>
            {SENT_SEG.filter((x) => counts[x.key] > 0).map((x, i) => (
              <div key={x.key} className={`${x.fill} ${i > 0 ? "border-l-2 border-ink" : ""}`} style={{ width: `${(counts[x.key] / total) * 100}%` }} />
            ))}
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
            {SENT_SEG.map((x) => (
              <li key={x.key} className="flex items-center gap-2">
                <span className={`h-3 w-3 border-2 border-ink ${x.fill}`} aria-hidden="true" />
                <span className="text-xs font-semibold text-gray-700">
                  {x.label} <span className="font-mono font-bold tabular-nums text-ink">{counts[x.key]}</span>
                </span>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Daily trend</p>
            <div className="flex h-16 items-end gap-[3px]">
              {s.trend.map((d) => {
                const sum = d.positive + d.neutral + d.negative;
                if (sum === 0) {
                  return <div key={d.date} className="flex-1" title={`${shortDay(d.date)}, no scored calls`}><div className="h-px w-full bg-gray-200" /></div>;
                }
                return (
                  <div
                    key={d.date}
                    title={`${shortDay(d.date)}, ${d.positive} positive · ${d.neutral} neutral · ${d.negative} negative`}
                    className="flex flex-1 flex-col justify-end border border-ink/20"
                    style={{ height: `${Math.max(8, (sum / tMax) * 100)}%` }}
                  >
                    {d.positive > 0 ? <div className="w-full bg-brut-lime" style={{ height: `${(d.positive / sum) * 100}%` }} /> : null}
                    {d.neutral > 0 ? <div className="w-full bg-gray-200" style={{ height: `${(d.neutral / sum) * 100}%` }} /> : null}
                    {d.negative > 0 ? <div className="w-full bg-brut-red" style={{ height: `${(d.negative / sum) * 100}%` }} /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- Loyalty */

/** New vs returning numbers, plus the most frequent callers. */
export function LoyaltyPanel({ l }: { l: LoyaltyData }) {
  const known = l.newCallers + l.returningCallers;
  const returningPct = known ? Math.round((l.returningCallers / known) * 100) : 0;

  return (
    <Panel title="Repeat callers">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-[3px] border-2 border-ink bg-ink">
          <div className="bg-brut-yellow px-4 py-3">
            <p className="font-mono text-3xl font-extrabold tabular-nums leading-none text-ink">{l.returningCallers}</p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-ink/70">Returning · {returningPct}%</p>
          </div>
          <div className="bg-paper px-4 py-3">
            <p className="font-mono text-3xl font-extrabold tabular-nums leading-none text-ink">{l.newCallers}</p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-gray-500">New numbers</p>
          </div>
        </div>

        {l.repeat.length === 0 ? (
          <p className="text-sm text-gray-600">No repeat callers yet. As numbers call back, your most frequent callers rank here.</p>
        ) : (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Most frequent</p>
            <ul className="space-y-2">
              {l.repeat.map((r, i) => (
                <li key={r.caller} className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold tabular-nums text-gray-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{r.caller}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-gray-500">{fmtDay(r.lastAt)}</span>
                  <span className="shrink-0 border-2 border-ink bg-brut-cyan px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{r.calls}&times;</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
