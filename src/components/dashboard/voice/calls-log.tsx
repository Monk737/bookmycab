"use client";

import { useState } from "react";
import { LogShell } from "./log-shell";
import { TranscriptDrawer, type DrawerCall } from "./transcript-drawer";
import { fmtDateTime, formatDuration, localDateKey } from "@/lib/voice/format";
import type { VoiceCallLogRow } from "@/lib/voice/call-log";

const OUTCOME_STYLE: Record<string, string> = {
  booked: "bg-brut-lime", modified: "bg-brut-violet", cancelled: "bg-brut-pink",
  quoted: "bg-brut-cyan", abandoned: "bg-brut-orange", transferred: "bg-brut-blue",
  failed: "bg-brut-red", no_credit: "bg-brut-red",
};

/**
 * Main AI Voice "Recent calls": browse every call in the window, click one to
 * read its transcript and play the recording. Kept deliberately simple — the
 * quality signals (sentiment, goal-met, flags) live on the Agent quality page.
 */
export function CallsLog({ calls }: { calls: VoiceCallLogRow[] }) {
  const [active, setActive] = useState<DrawerCall | null>(null);
  return (
    <>
      <LogShell
        title="Recent calls"
        items={calls}
        getKey={(c) => c.id}
        getDate={(c) => localDateKey(c.startedAt)}
        getSearchText={(c) =>
          [c.callerName, c.caller, c.agentName, c.outcome.replace("_", " "), c.summary, fmtDateTime(c.startedAt)]
            .filter(Boolean)
            .join(" ")
        }
        searchPlaceholder="Search caller, outcome, summary…"
        emptyLabel="No calls on this day."
        noneLabel="No calls recorded yet. When your AI Voice agent answers a call, it lands here."
        renderItem={(c) => (
          <button
            type="button"
            onClick={() => setActive({ id: c.id, caller: c.caller, callerName: c.callerName, outcome: c.outcome, startedAt: c.startedAt })}
            className="brut-focus block w-full text-left transition-colors hover:bg-brut-yellow/15"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className={`shrink-0 border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_STYLE[c.outcome] ?? "bg-gray-100"}`}>
                {c.outcome.replace("_", " ")}
              </span>
              {c.callerName ? <span className="text-sm font-bold text-ink">{c.callerName}</span> : null}
              {c.caller ? (
                <span className="font-mono text-xs text-gray-600">{c.caller}</span>
              ) : !c.callerName ? (
                <span className="text-xs text-gray-400">number withheld</span>
              ) : null}
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">{c.agentName}</span>
              <span className="font-mono text-xs tabular-nums text-gray-500">{fmtDateTime(c.startedAt)}</span>
              {c.durationS != null ? <span className="font-mono text-xs tabular-nums text-gray-500">· {formatDuration(c.durationS)}</span> : null}
              {c.hasRecording ? (
                <span className="inline-flex shrink-0 items-center gap-1 border-2 border-ink bg-brut-cyan px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />Rec
                </span>
              ) : null}
            </div>
            {c.summary ? (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-700">{c.summary}</p>
            ) : (
              <p className="mt-1 text-xs italic text-gray-400">No synopsis captured for this call.</p>
            )}
          </button>
        )}
      />
      <TranscriptDrawer call={active} onClose={() => setActive(null)} />
    </>
  );
}
