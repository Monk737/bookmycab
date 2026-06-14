"use client";

import { LogShell } from "./log-shell";
import { fmtDateTime, formatDuration, localDateKey } from "@/lib/voice/format";
import type { VoiceCallLogRow } from "@/lib/voice/call-log";

const OUTCOME_STYLE: Record<string, string> = {
  booked: "bg-brut-lime",
  quoted: "bg-brut-cyan",
  failed: "bg-brut-pink",
  no_credit: "bg-brut-pink",
};

function CallRow(c: VoiceCallLogRow) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs tabular-nums text-gray-500">{fmtDateTime(c.startedAt)}</span>
        <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink">{c.agentName}</span>
        {c.caller ? <span className="font-mono text-xs text-gray-500">{c.caller}</span> : null}
        <span
          className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${
            OUTCOME_STYLE[c.outcome] ?? "bg-gray-100"
          }`}
        >
          {c.outcome.replace("_", " ")}
        </span>
        {c.durationS != null ? (
          <span className="font-mono text-xs tabular-nums text-gray-500">{formatDuration(c.durationS)}</span>
        ) : null}
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
          {c.creditSource === "plan" ? "plan call" : c.creditSource === "topup" ? "top-up credit" : "not charged"}
        </span>
      </div>
      {c.summary ? <p className="max-w-2xl text-sm leading-relaxed text-gray-700">{c.summary}</p> : null}
    </div>
  );
}

export function CallsLog({ calls }: { calls: VoiceCallLogRow[] }) {
  return (
    <LogShell
      title="Recent calls"
      items={calls}
      getKey={(c) => c.id}
      getDate={(c) => localDateKey(c.startedAt)}
      getSearchText={(c) =>
        [c.agentName, c.caller, c.outcome.replace("_", " "), c.creditSource, c.summary, fmtDateTime(c.startedAt)]
          .filter(Boolean)
          .join(" ")
      }
      renderItem={CallRow}
      searchPlaceholder="Search caller, outcome, summary…"
      emptyLabel="No calls on this day."
      noneLabel="No calls recorded yet. When your AI Voice agent answers a call, it lands here."
    />
  );
}
