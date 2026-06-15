"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogShell } from "./log-shell";
import { TranscriptDrawer, type DrawerCall } from "./transcript-drawer";
import { updateCallReviewStatus } from "@/app/dashboard/voice/quality/actions";
import { fmtDateTime, formatDuration, localDateKey } from "@/lib/voice/format";
import type { ReviewCall, RecentCallMeta } from "@/lib/voice/quality";

const OUTCOME_BADGE: Record<string, string> = {
  booked: "bg-brut-lime", modified: "bg-brut-violet", cancelled: "bg-brut-pink",
  quoted: "bg-brut-cyan", abandoned: "bg-brut-orange", failed: "bg-brut-red", transferred: "bg-brut-blue",
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span className={`shrink-0 border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_BADGE[outcome] ?? "bg-gray-100"}`}>
      {outcome}
    </span>
  );
}

function CallerLine({ caller, callerName }: { caller: string | null; callerName: string | null }) {
  return (
    <>
      {callerName ? <span className="text-sm font-bold text-ink">{callerName}</span> : null}
      {caller ? (
        <span className="font-mono text-xs text-gray-600">{caller}</span>
      ) : !callerName ? (
        <span className="text-xs text-gray-400">number withheld</span>
      ) : null}
    </>
  );
}

function RecBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 border-2 border-ink bg-brut-cyan px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />Rec
    </span>
  );
}

/* Quality signal chips (Agent quality recent cards) — colour + word, CVD-safe. */
const SENTIMENT_CHIP: Record<string, { label: string; fill: string }> = {
  positive: { label: "Positive", fill: "bg-brut-lime" },
  neutral: { label: "Neutral", fill: "bg-gray-200" },
  negative: { label: "Negative", fill: "bg-brut-red" },
};
function SentimentChip({ sentiment }: { sentiment: string | null }) {
  const s = sentiment ? SENTIMENT_CHIP[sentiment] : null;
  if (!s) return null;
  return <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink ${s.fill}`}>{s.label}</span>;
}
function GoalChip({ success }: { success: boolean | null }) {
  if (success == null) return null;
  return (
    <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink ${success ? "bg-brut-lime" : "bg-brut-red"}`}>
      {success ? "Goal met" : "Goal missed"}
    </span>
  );
}
function AddressChip({ n }: { n: number | null }) {
  if (n == null || n < 4) return null;
  return <span className="border-2 border-ink bg-brut-violet px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">Address &times;{n}</span>;
}

/* -------------------------------------------------------------- Recent calls */

/**
 * Browse any call in the window. Richer cards (name, number, synopsis) so the
 * operator can scan before opening the transcript + recording drawer.
 */
export function RecentCalls({ items, windowLabel }: { items: RecentCallMeta[]; windowLabel: string }) {
  const [active, setActive] = useState<DrawerCall | null>(null);
  return (
    <>
      <LogShell
        title="Recent calls"
        items={items}
        windowLabel={windowLabel}
        getKey={(c) => c.id}
        getDate={(c) => localDateKey(c.startedAt)}
        getSearchText={(c) => [c.callerName, c.caller, c.outcome, c.synopsis, fmtDateTime(c.startedAt)].filter(Boolean).join(" ")}
        searchPlaceholder="Search caller, outcome, synopsis…"
        emptyLabel="No calls on this day."
        noneLabel="No calls recorded yet. When your AI Voice agent answers a call, it lands here."
        renderItem={(c) => {
          const hasSignals = c.sentiment != null || c.success != null || (c.addressLookups ?? 0) >= 4;
          return (
            <button
              type="button"
              onClick={() => setActive({ id: c.id, caller: c.caller, callerName: c.callerName, outcome: c.outcome, startedAt: c.startedAt })}
              className="brut-focus block w-full text-left transition-colors hover:bg-brut-yellow/15"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <OutcomeBadge outcome={c.outcome} />
                <CallerLine caller={c.caller} callerName={c.callerName} />
                <span className="font-mono text-xs tabular-nums text-gray-500">{fmtDateTime(c.startedAt)}</span>
                {c.durationS != null ? <span className="font-mono text-xs tabular-nums text-gray-500">· {formatDuration(c.durationS)}</span> : null}
                {c.hasRecording ? <RecBadge /> : null}
              </div>
              {hasSignals ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <SentimentChip sentiment={c.sentiment} />
                  <GoalChip success={c.success} />
                  <AddressChip n={c.addressLookups} />
                </div>
              ) : null}
              {c.synopsis ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-700">{c.synopsis}</p>
              ) : (
                <p className="mt-1.5 text-xs italic text-gray-400">No synopsis captured for this call.</p>
              )}
            </button>
          );
        }}
      />
      <TranscriptDrawer call={active} onClose={() => setActive(null)} />
    </>
  );
}

/* -------------------------------------------------------------- Review queue */

// Reason -> fill. Each reason owns a colour, but the words carry the meaning so
// the queue stays readable for colour-blind operators (never colour alone).
const REASON_STYLE: Record<string, string> = {
  "System error": "bg-brut-red",
  "Caller abandoned": "bg-brut-orange",
  "Repeated address confusion": "bg-brut-violet",
  "Unusually long": "bg-brut-cyan",
  "Goal not met": "bg-brut-yellow",
};

function SeverityTag({ severity }: { severity: number }) {
  const s = severity >= 4 ? { label: "High", fill: "bg-brut-red" } : severity >= 2 ? { label: "Med", fill: "bg-brut-orange" } : { label: "Low", fill: "bg-brut-yellow" };
  return (
    <span className={`shrink-0 border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${s.fill}`} title={`Severity ${severity}`}>
      {s.label}
    </span>
  );
}

/**
 * Triage workflow: the calls the agent struggled with, most urgent first, with
 * the detected reasons. The operator opens the transcript, then marks the call
 * reviewed or dismisses it — either way it leaves the queue. This is the
 * human-in-the-loop tuning step (nothing auto-edits the agent).
 */
export function CallsToReview({ items, windowLabel }: { items: ReviewCall[]; windowLabel: string }) {
  const router = useRouter();
  const [active, setActive] = useState<DrawerCall | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function act(callId: string, status: "reviewed" | "dismissed") {
    setBusyId(callId);
    startTransition(async () => {
      await updateCallReviewStatus({ callId, status });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <>
      <LogShell
        title="Calls to review"
        items={items}
        allByDefault
        windowLabel={windowLabel}
        badge={<span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{items.length}</span>}
        sortAll={(a, b) => b.severity - a.severity || (a.startedAt < b.startedAt ? 1 : -1)}
        getKey={(c) => c.id}
        getDate={(c) => localDateKey(c.startedAt)}
        getSearchText={(c) => [c.callerName, c.caller, c.outcome, c.reasons.join(" "), c.synopsis].filter(Boolean).join(" ")}
        searchPlaceholder="Search reason, caller, synopsis…"
        emptyLabel="Nothing flagged on this day."
        noneLabel="Nothing flagged. The agent handled every call in this window cleanly."
        renderItem={(c) => {
          const busy = pending && busyId === c.id;
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <SeverityTag severity={c.severity} />
                <OutcomeBadge outcome={c.outcome} />
                <CallerLine caller={c.caller} callerName={c.callerName} />
                <span className="font-mono text-xs tabular-nums text-gray-500">{fmtDateTime(c.startedAt)}</span>
                {c.durationS != null ? <span className="font-mono text-xs tabular-nums text-gray-500">· {formatDuration(c.durationS)}</span> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.reasons.map((r) => (
                  <span key={r} className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink ${REASON_STYLE[r] ?? "bg-gray-100"}`}>{r}</span>
                ))}
              </div>
              {c.synopsis ? <p className="line-clamp-2 text-sm leading-relaxed text-gray-700">{c.synopsis}</p> : null}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActive({ id: c.id, caller: c.caller, callerName: c.callerName, outcome: c.outcome, startedAt: c.startedAt })}
                  className="brut-press brut-focus border-2 border-ink bg-brut-yellow px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink"
                >
                  Review &rarr;
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(c.id, "reviewed")}
                  className="brut-press brut-focus border-2 border-ink bg-brut-lime px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink disabled:opacity-50"
                >
                  Mark reviewed
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(c.id, "dismissed")}
                  className="brut-press brut-focus border-2 border-ink bg-paper px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        }}
      />
      <TranscriptDrawer call={active} onClose={() => setActive(null)} />
    </>
  );
}
