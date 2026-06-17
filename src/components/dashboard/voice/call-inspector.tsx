"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TranscriptDrawer, type DrawerCall } from "./transcript-drawer";
import { updateCallReviewStatus } from "@/app/dashboard/voice/quality/actions";
import { formatDuration } from "@/lib/voice/format";
import type { RecentCallMeta } from "@/lib/voice/quality";

// Restrained palette: ink / paper / grey structure, taxi-yellow as the single UI
// accent (header, current selection, primary action), and red reserved for
// genuine problems. No per-outcome rainbow — the outcome word carries meaning.
const NEGATIVE_OUTCOME = new Set(["failed", "abandoned", "no_credit"]);
const outcomeFill = (outcome: string) => (NEGATIVE_OUTCOME.has(outcome) ? "bg-brut-red" : "bg-paper");
const outcomeDot = (outcome: string) => (NEGATIVE_OUTCOME.has(outcome) ? "bg-brut-red" : "bg-ink");

const SENTIMENT: Record<string, { label: string; dot: string }> = {
  positive: { label: "Positive", dot: "bg-ink" },
  neutral: { label: "Neutral", dot: "bg-gray-300" },
  negative: { label: "Negative", dot: "bg-brut-red" },
};
const RELOOKUP_THRESHOLD = 4;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dmon = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const longWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

type FilterKey = "all" | "flagged" | "booked" | "missed" | "negative";

function severityTag(severity: number) {
  if (severity >= 4) return { label: "High", fill: "bg-brut-red" };
  if (severity >= 2) return { label: "Med", fill: "bg-gray-300" };
  return { label: "Low", fill: "bg-gray-200" };
}

/* A flat ink-framed readout block in the detail panel. Stays on paper; a bad
   signal is flagged by a red figure, not a coloured fill. */
function Signal({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className="flex min-h-[4.5rem] flex-col justify-between bg-paper px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/70">{label}</p>
      <div>
        <p className={`font-mono text-lg font-extrabold tabular-nums leading-none ${bad ? "text-brut-red-deep" : "text-ink"}`}>{value}</p>
        {sub ? <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink/60">{sub}</p> : null}
      </div>
    </div>
  );
}

/* A single number in the inspector's summary strip. Paper tile; a problem count
   turns its figure red so attention tracks meaning, not decoration. */
function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="bg-paper px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-extrabold tabular-nums leading-none ${bad ? "text-brut-red-deep" : "text-ink"}`}>{value.toLocaleString("en-GB")}</p>
    </div>
  );
}

/* The right-hand inspector for one selected call, with inline review actions. */
function Detail({ call, onOpen }: { call: RecentCallMeta; onOpen: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sent = call.sentiment ? SENTIMENT[call.sentiment] : null;
  const lookups = call.addressLookups ?? 0;
  const struggled = lookups >= RELOOKUP_THRESHOLD;
  const flagged = call.reasons.length > 0;
  const sev = severityTag(call.severity);

  const action = (status: "reviewed" | "dismissed") =>
    start(async () => {
      await updateCallReviewStatus({ callId: call.id, status });
      router.refresh();
    });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${outcomeFill(call.outcome)}`}>
          {call.outcome}
        </span>
        {flagged ? (
          <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${sev.fill}`} title={`Severity ${call.severity}`}>
            {sev.label} priority
          </span>
        ) : null}
        {call.reviewed ? (
          <span className="border-2 border-ink bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">Reviewed</span>
        ) : null}
        <span className="text-base font-bold text-ink">{call.callerName ?? "Unknown caller"}</span>
        {call.caller ? <span className="font-mono text-xs text-gray-600">{call.caller}</span> : <span className="text-xs text-gray-400">number withheld</span>}
        <span className="font-mono text-xs tabular-nums text-gray-500">{longWhen(call.startedAt)}</span>
      </div>

      {/* Quality readout on a hairline ink bed. */}
      <div className="grid grid-cols-2 gap-[3px] border-2 border-ink bg-ink sm:grid-cols-4">
        <Signal label="Sentiment" value={sent ? sent.label : "—"} bad={call.sentiment === "negative"} />
        <Signal
          label="Goal"
          value={call.success == null ? "—" : call.success ? "Met" : "Missed"}
          bad={call.success === false}
        />
        <Signal label="Handle time" value={call.durationS != null ? formatDuration(call.durationS) : "—"} />
        <Signal label="Address looks" value={String(lookups)} bad={struggled} sub={struggled ? "Re-lookups" : undefined} />
      </div>

      {flagged ? (
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Why it&rsquo;s flagged</p>
          <div className="flex flex-wrap gap-1.5">
            {call.reasons.map((r) => (
              <span key={r} className="border-2 border-ink bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">{r}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Synopsis</p>
        {call.synopsis ? (
          <p className="max-w-prose text-sm leading-relaxed text-gray-700">{call.synopsis}</p>
        ) : (
          <p className="text-sm italic text-gray-400">No synopsis captured for this call.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-t-2 border-gray-100 pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="brut-press brut-focus inline-flex h-10 items-center border-[3px] border-ink bg-brut-yellow px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut"
        >
          Open transcript + recording
        </button>
        {call.reviewed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => action("dismissed")}
            className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
          >
            Reopen
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => action("reviewed")}
              className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-ink px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-paper disabled:opacity-50"
            >
              Mark reviewed
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => action("dismissed")}
              className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
            >
              Dismiss
            </button>
          </>
        )}
        {call.hasRecording ? (
          <span className="ml-auto inline-flex items-center gap-1.5 border-2 border-ink bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />Recording
          </span>
        ) : null}
      </div>
    </div>
  );
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flagged", label: "Flagged" },
  { key: "booked", label: "Booked" },
  { key: "missed", label: "Missed goal" },
  { key: "negative", label: "Negative" },
];

/**
 * Call Inspector — the one place to browse, triage and grade calls. Filter to
 * flagged / booked / missed-goal / negative, search the window, read each call's
 * quality signals and flag reasons, action it (mark reviewed / dismiss) and open
 * the full transcript + recording. Replaces the separate review queue.
 */
export function CallInspector({
  items,
  windowLabel,
  reasonFilter,
  onClearReason,
}: {
  items: RecentCallMeta[];
  windowLabel: string;
  /** When set (from the failure clusters above), narrow to calls with this flag. */
  reasonFilter?: string | null;
  onClearReason?: () => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<DrawerCall | null>(null);

  const counts = useMemo(
    () => ({
      total: items.length,
      flagged: items.filter((c) => c.reasons.length > 0).length,
      booked: items.filter((c) => c.outcome === "booked").length,
      missed: items.filter((c) => c.success === false).length,
      negative: items.filter((c) => c.sentiment === "negative").length,
    }),
    [items],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    // A reason drill-down from the clusters takes precedence and sorts by severity.
    let list = reasonFilter
      ? items.filter((c) => c.reasons.includes(reasonFilter)).slice().sort((a, b) => b.severity - a.severity || (a.startedAt < b.startedAt ? 1 : -1))
      : items;
    if (!reasonFilter) {
      if (filter === "flagged") list = items.filter((c) => c.reasons.length > 0).slice().sort((a, b) => b.severity - a.severity || (a.startedAt < b.startedAt ? 1 : -1));
      else if (filter === "booked") list = items.filter((c) => c.outcome === "booked");
      else if (filter === "missed") list = items.filter((c) => c.success === false);
      else if (filter === "negative") list = items.filter((c) => c.sentiment === "negative");
    }
    if (q) list = list.filter((c) => [c.callerName, c.caller, c.outcome, c.synopsis, c.sentiment, c.reasons.join(" ")].filter(Boolean).join(" ").toLowerCase().includes(q));
    return list;
  }, [items, filter, q, reasonFilter]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  if (items.length === 0) {
    return (
      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="border-b-[3px] border-ink bg-brut-yellow px-5 py-3.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Call Inspector</h2>
        </header>
        <p className="px-5 py-12 text-center text-sm text-gray-600">No calls to inspect in {windowLabel}.</p>
      </section>
    );
  }

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="border-b-[3px] border-ink bg-brut-yellow px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Call Inspector</h2>
            <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{items.length}</span>
          </div>
          <p className="text-xs font-semibold text-ink/70">Browse, triage and grade every call, then open the transcript.</p>
        </div>
      </header>

      {/* Summary strip. */}
      <div className="grid grid-cols-2 gap-[3px] border-b-[3px] border-ink bg-ink sm:grid-cols-5">
        <Stat label="Calls" value={counts.total} />
        <Stat label="Flagged" value={counts.flagged} bad={counts.flagged > 0} />
        <Stat label="Booked" value={counts.booked} />
        <Stat label="Missed goal" value={counts.missed} bad={counts.missed > 0} />
        <Stat label="Negative" value={counts.negative} bad={counts.negative > 0} />
      </div>

      {/* Reason drill-down banner (from the failure clusters above). */}
      {reasonFilter ? (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-brut-yellow px-4 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink">Flagged reason</span>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 text-xs font-bold text-ink">{reasonFilter}</span>
          <span className="font-mono text-[11px] font-bold tabular-nums text-ink/70">{filtered.length} call{filtered.length === 1 ? "" : "s"}</span>
          <button
            type="button"
            onClick={onClearReason}
            className="brut-press brut-focus ml-auto inline-flex h-7 items-center border-2 border-ink bg-paper px-2 text-[11px] font-bold uppercase tracking-[0.04em] text-ink"
          >
            Clear &times;
          </button>
        </div>
      ) : null}

      {/* Filter chips. */}
      <div className={`flex flex-wrap items-center gap-1.5 border-b-2 border-gray-100 px-4 py-2.5 ${reasonFilter ? "pointer-events-none opacity-40" : ""}`}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const n = f.key === "all" ? counts.total : counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`brut-press brut-focus inline-flex h-8 items-center gap-1.5 border-2 border-ink px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink ${active ? "bg-ink text-paper" : "bg-paper hover:bg-brut-yellow"}`}
            >
              <span>{f.label}</span>
              <span className={`font-mono tabular-nums ${active ? "text-paper/70" : "text-gray-500"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:h-[34rem] lg:flex-row">
        {/* Rail */}
        <div className="flex shrink-0 flex-col border-b-[3px] border-ink lg:h-full lg:w-72 lg:border-b-0 lg:border-r-[3px]">
          <div className="relative border-b-2 border-gray-100 p-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search calls…"
              aria-label="Search calls"
              className="brut-focus h-8 w-full border-2 border-ink bg-paper pl-7 pr-2 text-xs text-ink placeholder:text-gray-400"
            />
          </div>
          <ul className="scrollbar-ink max-h-[18rem] flex-1 overflow-y-auto lg:max-h-none">
            {filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-gray-500">No calls match.</li>
            ) : (
              filtered.map((c) => {
                const isSel = selected?.id === c.id;
                const sent = c.sentiment ? SENTIMENT[c.sentiment] : null;
                const flagged = c.reasons.length > 0;
                const sev = severityTag(c.severity);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-current={isSel ? "true" : undefined}
                      className={`brut-focus flex w-full flex-col gap-1 border-b-2 border-gray-100 px-3 py-2.5 text-left ${isSel ? "bg-brut-yellow" : "bg-paper hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold tabular-nums text-ink">{hhmm(c.startedAt)}</span>
                        <span className="flex items-center gap-1">
                          {flagged ? <span className={`border border-ink px-1 text-[9px] font-bold uppercase text-ink ${sev.fill}`} title={`Severity ${c.severity}`}>{sev.label}</span> : null}
                          {c.reviewed ? <span className="border border-ink bg-gray-200 px-1 text-[9px] font-bold uppercase text-ink">✓</span> : null}
                          <span className="font-mono text-[10px] tabular-nums text-gray-500">{dmon(c.startedAt)}</span>
                        </span>
                      </div>
                      <span className="truncate text-sm font-bold text-ink">{c.callerName ?? c.caller ?? "Unknown caller"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 border border-ink ${outcomeDot(c.outcome)}`} aria-hidden="true" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-gray-600">{c.outcome}</span>
                        <span className="ml-auto flex items-center gap-1">
                          {sent ? <span className={`h-2.5 w-2.5 border border-ink ${sent.dot}`} title={`Sentiment: ${sent.label}`} aria-hidden="true" /> : null}
                          {c.success === true ? (
                            <span className="h-2.5 w-2.5 border border-ink bg-ink" title="Goal met" aria-hidden="true" />
                          ) : c.success === false ? (
                            <span className="h-2.5 w-2.5 border border-ink bg-brut-red" title="Goal missed" aria-hidden="true" />
                          ) : null}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Detail */}
        <div className="scrollbar-ink min-w-0 flex-1 overflow-y-auto p-5">
          {selected ? (
            <Detail
              call={selected}
              onOpen={() => setDrawer({ id: selected.id, caller: selected.caller, callerName: selected.callerName, outcome: selected.outcome, startedAt: selected.startedAt })}
            />
          ) : (
            <p className="py-10 text-center text-sm text-gray-500">No call selected.</p>
          )}
        </div>
      </div>

      <TranscriptDrawer call={drawer} onClose={() => setDrawer(null)} />
    </section>
  );
}
