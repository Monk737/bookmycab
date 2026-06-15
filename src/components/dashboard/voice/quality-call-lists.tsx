"use client";

import { useState } from "react";
import { TranscriptDrawer, type DrawerCall } from "./transcript-drawer";
import type { ReviewCall, RecentCallMeta } from "@/lib/voice/quality";

/* ------------------------------------------------------------------- shared */

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

const OUTCOME_BADGE: Record<string, string> = {
  booked: "bg-brut-lime", modified: "bg-brut-violet", cancelled: "bg-brut-pink",
  quoted: "bg-brut-cyan", abandoned: "bg-brut-orange", failed: "bg-brut-red", transferred: "bg-brut-blue",
};

/** One drawer instance per list; only one is ever open, so this stays simple. */
function useCallDrawer() {
  const [active, setActive] = useState<DrawerCall | null>(null);
  return { active, open: setActive, close: () => setActive(null) };
}

/* -------------------------------------------------------------- Review queue */

// Reason -> fill. Each reason owns a colour, but the words carry the meaning so
// the queue is readable for colour-blind operators (never colour alone).
const REASON_STYLE: Record<string, string> = {
  "System error": "bg-brut-red",
  "Caller abandoned": "bg-brut-orange",
  "Repeated address confusion": "bg-brut-violet",
  "Unusually long": "bg-brut-cyan",
  "Goal not met": "bg-brut-yellow",
};

/**
 * The self-improvement loop: calls the agent struggled with (failed, abandoned,
 * over-long, or stuck re-looking-up an address), each with the detected reason
 * and a one-tap jump into the transcript + recording.
 */
export function CallsToReview({ items }: { items: ReviewCall[] }) {
  const drawer = useCallDrawer();
  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-[3px] border-ink px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Calls to review</h2>
          <span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{items.length}</span>
        </div>
        <p className="text-xs text-gray-600">Where the agent struggled. Listen, then tune the prompt.</p>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-600">Nothing flagged. The agent handled every call in this window cleanly.</p>
      ) : (
        <ul className="divide-y-2 divide-gray-100">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_BADGE[it.outcome] ?? "bg-gray-100"}`}>
                    {it.outcome}
                  </span>
                  {it.callerName ? <span className="text-sm font-bold text-ink">{it.callerName}</span> : null}
                  {it.caller ? (
                    <span className="font-mono text-xs text-gray-600">{it.caller}</span>
                  ) : !it.callerName ? (
                    <span className="text-xs text-gray-400">number withheld</span>
                  ) : null}
                  <span className="font-mono text-xs tabular-nums text-gray-500">{fmtWhen(it.startedAt)}</span>
                  {it.durationS != null ? <span className="font-mono text-xs tabular-nums text-gray-500">· {fmtDur(it.durationS)}</span> : null}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {it.reasons.map((r) => (
                    <span key={r} className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink ${REASON_STYLE[r] ?? "bg-gray-100"}`}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => drawer.open({ id: it.id, caller: it.caller, callerName: it.callerName, outcome: it.outcome, startedAt: it.startedAt })}
                className="brut-press brut-focus shrink-0 self-start border-2 border-ink bg-brut-yellow px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink sm:self-auto"
              >
                Review &rarr;
              </button>
            </li>
          ))}
        </ul>
      )}

      <TranscriptDrawer call={drawer.active} onClose={drawer.close} />
    </section>
  );
}

/* -------------------------------------------------------------- Recent calls */

/** Any recent call, one row per line, opening its transcript + recording. */
export function RecentCalls({ items }: { items: RecentCallMeta[] }) {
  const drawer = useCallDrawer();
  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-[3px] border-ink px-5 py-3.5">
        <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Recent calls</h2>
        <p className="text-xs text-gray-600">Open any call for its transcript &amp; recording.</p>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-600">No calls recorded yet.</p>
      ) : (
        <ul className="divide-y-2 divide-gray-100">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => drawer.open({ id: it.id, caller: it.caller, callerName: it.callerName, outcome: it.outcome, startedAt: it.startedAt })}
                className="brut-focus flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-brut-yellow/20"
              >
                <span className={`shrink-0 border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_BADGE[it.outcome] ?? "bg-gray-100"}`}>
                  {it.outcome}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {it.callerName ? <span className="font-bold">{it.callerName} </span> : null}
                  {it.caller ? <span className="font-mono text-xs text-gray-600">{it.caller}</span> : <span className="text-xs text-gray-400">number withheld</span>}
                </span>
                {it.hasRecording ? (
                  <span className="inline-flex shrink-0 items-center gap-1 border-2 border-ink bg-brut-cyan px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />Rec
                  </span>
                ) : null}
                {it.durationS != null ? <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">{fmtDur(it.durationS)}</span> : null}
                <span className="hidden shrink-0 font-mono text-xs tabular-nums text-gray-500 sm:inline">{fmtWhen(it.startedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TranscriptDrawer call={drawer.active} onClose={drawer.close} />
    </section>
  );
}
