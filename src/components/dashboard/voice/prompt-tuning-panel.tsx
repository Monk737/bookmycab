// src/components/dashboard/voice/prompt-tuning-panel.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PromptDiff } from "./prompt-diff";
import {
  runPromptDetection,
  requestPromptSuggestion,
  dismissPromptSuggestion,
  type PromptActionState,
} from "@/app/dashboard/voice/quality/actions";
import type { PromptSuggestion } from "@/lib/voice/prompt-tuning";

const REASON_STYLE: Record<string, string> = {
  "System error": "bg-brut-red",
  "Caller abandoned": "bg-brut-orange",
  "Repeated address confusion": "bg-brut-violet",
  "Unusually long": "bg-brut-cyan",
  "Goal not met": "bg-brut-yellow",
};
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function DeltaChip({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null)
    return <span className="border-2 border-ink bg-brut-orange px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">New</span>;
  return (
    <span className="border-2 border-ink bg-brut-red px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
      ▲ {deltaPct}%
    </span>
  );
}

function SuggestionCard({ s }: { s: PromptSuggestion }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<PromptActionState>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? res.message ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <li className="border-2 border-ink bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper px-4 py-2.5">
        <span className={`h-3 w-3 shrink-0 border-2 border-ink ${REASON_STYLE[s.reason] ?? "bg-gray-200"}`} aria-hidden="true" />
        <span className="text-sm font-bold text-ink">{s.reason}</span>
        <span className="font-mono text-xs font-bold tabular-nums text-ink/70">{s.reasonCount} calls</span>
        <DeltaChip deltaPct={s.reasonDeltaPct} />
        <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{s.agentName}</span>
        {s.status === "requested" ? (
          <span className="border-2 border-ink bg-brut-cyan px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
            Sent to FlowMo{s.requestedAt ? ` · ${when(s.requestedAt)}` : ""}
          </span>
        ) : null}
        {s.status === "applied" ? (
          <span className="border-2 border-ink bg-brut-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
            Applied{s.resolvedAt ? ` · ${when(s.resolvedAt)}` : ""}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-3">
        {s.rationale ? <p className="max-w-prose text-sm leading-relaxed text-gray-700">{s.rationale}</p> : null}

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Proposed prompt change</p>
          <PromptDiff oldPrompt={s.oldPrompt} newPrompt={s.newPrompt} />
        </div>

        {s.evidence.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Evidence · {s.evidence.length} call{s.evidence.length === 1 ? "" : "s"}</p>
            <ul className="divide-y-2 divide-gray-100 border-2 border-ink">
              {s.evidence.map((e) => (
                <li key={e.id} className="flex items-start gap-2 px-2.5 py-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-gray-500">{when(e.startedAt)}</span>
                  <span className="border border-ink bg-gray-100 px-1 text-[9px] font-bold uppercase text-ink">{e.outcome}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{e.summary ?? "No summary"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {s.status === "draft" ? (
          <div className="space-y-2 border-t-2 border-gray-100 pt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for FlowMo (what you're seeing, any context)…"
              aria-label="Optional note for FlowMo about this suggestion"
              rows={2}
              className="brut-focus w-full border-2 border-ink bg-paper px-2 py-1.5 text-xs text-ink placeholder:text-gray-400"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => requestPromptSuggestion({ suggestionId: s.id, note: note.trim() || undefined }))}
                className="brut-press brut-focus inline-flex h-10 items-center border-[3px] border-ink bg-brut-yellow px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut disabled:opacity-50"
              >
                Send to FlowMo to apply
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => dismissPromptSuggestion({ suggestionId: s.id }))}
                className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
              >
                Dismiss
              </button>
              {msg ? <span className="text-xs font-semibold text-gray-600">{msg}</span> : null}
            </div>
          </div>
        ) : msg ? (
          <p className="text-xs font-semibold text-gray-600">{msg}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Prompt-tuning suggestions — the lever for improving the agent. The detector
 * clusters a rising failure reason and drafts a revised system prompt; the
 * operator previews the diff + evidence and raises it to FlowMo, who apply it.
 */
export function PromptTuningPanel({ suggestions }: { suggestions: PromptSuggestion[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const check = () =>
    start(async () => {
      const res = await runPromptDetection();
      setMsg(res.error ?? res.message ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-[3px] border-ink bg-brut-violet px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Prompt-tuning suggestions</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{suggestions.length}</span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={check}
          className="brut-press brut-focus inline-flex h-9 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.05em] text-ink disabled:opacity-50"
        >
          {pending ? "Checking…" : "Check for suggestions"}
        </button>
      </header>

      {suggestions.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-gray-600">No tuning suggestions right now. When a failure reason starts rising, a drafted prompt fix will appear here to preview and send to FlowMo.</p>
          {msg ? <p className="mt-2 text-xs font-semibold text-gray-500">{msg}</p> : null}
        </div>
      ) : (
        <>
          {msg ? <p className="border-b-2 border-gray-100 px-5 py-2 text-xs font-semibold text-gray-600">{msg}</p> : null}
          <ul className="space-y-4 p-4">
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} s={s} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
