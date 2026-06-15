"use client";

import { useMemo, useState } from "react";
import { TranscriptDrawer, type DrawerCall } from "./transcript-drawer";
import { formatDuration } from "@/lib/voice/format";
import type { RecentCallMeta } from "@/lib/voice/quality";

const OUTCOME_BADGE: Record<string, string> = {
  booked: "bg-brut-lime", modified: "bg-brut-violet", cancelled: "bg-brut-pink",
  quoted: "bg-brut-cyan", abandoned: "bg-brut-orange", failed: "bg-brut-red", transferred: "bg-brut-blue",
};
const SENTIMENT: Record<string, { label: string; fill: string }> = {
  positive: { label: "Positive", fill: "bg-brut-lime" },
  neutral: { label: "Neutral", fill: "bg-gray-200" },
  negative: { label: "Negative", fill: "bg-brut-red" },
};
const RELOOKUP_THRESHOLD = 4;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dmon = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const longWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/* A flat ink-framed readout block in the detail panel. */
function Signal({ label, value, fill, sub }: { label: string; value: string; fill: string; sub?: string }) {
  return (
    <div className={`flex min-h-[4.5rem] flex-col justify-between px-3 py-2.5 ${fill}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/70">{label}</p>
      <div>
        <p className="font-mono text-lg font-extrabold tabular-nums leading-none text-ink">{value}</p>
        {sub ? <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink/60">{sub}</p> : null}
      </div>
    </div>
  );
}

/* The right-hand inspector for one selected call. */
function Detail({ call, onOpen }: { call: RecentCallMeta; onOpen: () => void }) {
  const sent = call.sentiment ? SENTIMENT[call.sentiment] : null;
  const lookups = call.addressLookups ?? 0;
  const struggled = lookups >= RELOOKUP_THRESHOLD;
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_BADGE[call.outcome] ?? "bg-gray-100"}`}>
          {call.outcome}
        </span>
        <span className="text-base font-bold text-ink">{call.callerName ?? "Unknown caller"}</span>
        {call.caller ? (
          <span className="font-mono text-xs text-gray-600">{call.caller}</span>
        ) : (
          <span className="text-xs text-gray-400">number withheld</span>
        )}
        <span className="font-mono text-xs tabular-nums text-gray-500">{longWhen(call.startedAt)}</span>
      </div>

      {/* Quality readout on a hairline ink bed. */}
      <div className="grid grid-cols-2 gap-[3px] border-2 border-ink bg-ink sm:grid-cols-4">
        <Signal label="Sentiment" value={sent ? sent.label : "—"} fill={sent ? sent.fill : "bg-paper"} />
        <Signal
          label="Goal"
          value={call.success == null ? "—" : call.success ? "Met" : "Missed"}
          fill={call.success == null ? "bg-paper" : call.success ? "bg-brut-lime" : "bg-brut-red"}
        />
        <Signal label="Handle time" value={call.durationS != null ? formatDuration(call.durationS) : "—"} fill="bg-paper" />
        <Signal label="Address looks" value={String(lookups)} fill={struggled ? "bg-brut-violet" : "bg-paper"} sub={struggled ? "Re-lookups" : undefined} />
      </div>

      <div className="flex-1">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Synopsis</p>
        {call.synopsis ? (
          <p className="max-w-prose text-sm leading-relaxed text-gray-700">{call.synopsis}</p>
        ) : (
          <p className="text-sm italic text-gray-400">No synopsis captured for this call.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="brut-press brut-focus inline-flex h-10 items-center border-[3px] border-ink bg-brut-yellow px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut"
        >
          Open transcript + recording
        </button>
        {call.hasRecording ? (
          <span className="inline-flex items-center gap-1.5 border-2 border-ink bg-brut-cyan px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />Recording
          </span>
        ) : (
          <span className="text-[11px] font-medium text-gray-400">No recording captured</span>
        )}
      </div>
    </div>
  );
}

/**
 * Call Inspector — the quality browse: pick a call from the rail and read its
 * intelligence in the detail panel (sentiment, goal met/missed, handle time,
 * address re-lookups, synopsis), then open the full transcript + recording. The
 * deliberate counterpart to the "Calls to review" triage queue above it.
 */
export function CallInspector({ items, windowLabel }: { items: RecentCallMeta[]; windowLabel: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<DrawerCall | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? items.filter((c) =>
            [c.callerName, c.caller, c.outcome, c.synopsis, c.sentiment].filter(Boolean).join(" ").toLowerCase().includes(q),
          )
        : items,
    [items, q],
  );
  // Selection always resolves within the visible (filtered) list.
  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  if (items.length === 0) {
    return (
      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="border-b-[3px] border-ink px-5 py-3.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Call Inspector</h2>
        </header>
        <p className="px-5 py-12 text-center text-sm text-gray-600">No calls to inspect in {windowLabel}.</p>
      </section>
    );
  }

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-[3px] border-ink px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Call Inspector</h2>
          <span className="border-2 border-ink bg-brut-cyan px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{items.length}</span>
        </div>
        <p className="text-xs text-gray-600">Pick a call to read its quality signals, then open the transcript.</p>
      </header>

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
              <li className="px-3 py-8 text-center text-sm text-gray-500">No calls match “{query.trim()}”.</li>
            ) : (
              filtered.map((c) => {
                const isSel = selected?.id === c.id;
                const sent = c.sentiment ? SENTIMENT[c.sentiment] : null;
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
                        <span className="font-mono text-[10px] tabular-nums text-gray-500">{dmon(c.startedAt)}</span>
                      </div>
                      <span className="truncate text-sm font-bold text-ink">{c.callerName ?? c.caller ?? "Unknown caller"}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 border border-ink ${OUTCOME_BADGE[c.outcome] ?? "bg-gray-200"}`} aria-hidden="true" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-gray-600">{c.outcome}</span>
                        <span className="ml-auto flex items-center gap-1">
                          {sent ? <span className={`h-2.5 w-2.5 border border-ink ${sent.fill}`} title={`Sentiment: ${sent.label}`} aria-hidden="true" /> : null}
                          {c.success === true ? (
                            <span className="h-2.5 w-2.5 border border-ink bg-brut-lime" title="Goal met" aria-hidden="true" />
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
