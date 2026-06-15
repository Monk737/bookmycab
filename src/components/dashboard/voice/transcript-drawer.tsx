"use client";

import { useEffect, useState } from "react";
import { getCallTranscript, type CallTranscript } from "@/app/dashboard/voice/quality/actions";

export interface DrawerCall {
  id: string;
  caller: string | null;
  callerName: string | null;
  outcome: string;
  startedAt: string;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const OUTCOME_BADGE: Record<string, string> = {
  booked: "bg-brut-lime", modified: "bg-brut-violet", cancelled: "bg-brut-pink",
  quoted: "bg-brut-cyan", abandoned: "bg-brut-orange", failed: "bg-brut-red", transferred: "bg-brut-blue",
};

/** Right-side drawer: a call's transcript (styled AI/caller turns) + audio playback. */
export function TranscriptDrawer({ call, onClose }: { call: DrawerCall | null; onClose: () => void }) {
  const [data, setData] = useState<CallTranscript | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!call) { setData(null); return; }
    let active = true;
    setLoading(true);
    getCallTranscript(call.id).then((d) => { if (active) { setData(d); setLoading(false); } });
    return () => { active = false; };
  }, [call]);

  useEffect(() => {
    if (!call) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [call, onClose]);

  if (!call) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Call transcript">
      <button type="button" aria-label="Close transcript" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-start justify-between gap-3 border-b-[3px] border-ink px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_BADGE[call.outcome] ?? "bg-gray-100"}`}>
                {call.outcome}
              </span>
              {call.callerName ? <span className="text-sm font-bold text-ink">{call.callerName}</span> : null}
              {call.caller ? <span className="font-mono text-xs text-gray-600">{call.caller}</span> : null}
            </div>
            <p className="mt-1 font-mono text-xs tabular-nums text-gray-500">{fmtWhen(call.startedAt)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="brut-press brut-focus shrink-0 border-2 border-ink bg-paper px-2.5 py-1.5 text-sm font-bold text-ink">&times;</button>
        </header>

        <div className="scrollbar-ink flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse border-2 border-gray-200 bg-gray-100" />)}
            </div>
          ) : !data?.ok ? (
            <p className="py-8 text-center text-sm text-gray-600">Could not load this call.</p>
          ) : (
            <>
              {data.recordingUrl ? (
                <div className="mb-4 border-[3px] border-ink bg-gray-50 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Recording</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls preload="none" src={data.recordingUrl} className="w-full" />
                </div>
              ) : null}

              {data.summary ? (
                <div className="mb-4 border-2 border-ink bg-brut-yellow/30 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink/70">Summary</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{data.summary}</p>
                </div>
              ) : null}

              {data.transcript ? (
                <TranscriptBody text={data.transcript} />
              ) : (
                <p className="py-6 text-center text-sm text-gray-500">
                  No transcript captured for this call (older call, or recording was off at the time).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TranscriptBody({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => {
        const isAI = /^(AI|Assistant|Bot)\s*:/i.test(line);
        const isUser = /^(User|Caller|Customer)\s*:/i.test(line);
        const body = line.replace(/^(AI|Assistant|Bot|User|Caller|Customer)\s*:\s*/i, "");
        return (
          <li key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <span className={`max-w-[85%] border-2 border-ink px-3 py-1.5 text-sm leading-relaxed ${
              isAI ? "bg-brut-cyan/40 text-ink" : isUser ? "bg-brut-yellow text-ink" : "bg-gray-50 text-gray-700"
            }`}>
              {body}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
