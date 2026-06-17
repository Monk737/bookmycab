// src/app/admin/prompt-tuning/prompt-request-board.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PromptDiff } from "@/components/dashboard/voice/prompt-diff";
import {
  applyPromptSuggestion,
  rollbackPromptRevision,
  declinePromptSuggestion,
  type AdminPromptActionState,
} from "./actions";
import type { PromptSuggestion, PromptRevision } from "@/lib/voice/prompt-tuning";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

function DeltaChip({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null)
    return <span className="border-2 border-ink bg-brut-orange px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">New</span>;
  return (
    <span className="border-2 border-ink bg-brut-red px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
      ▲ {deltaPct}%
    </span>
  );
}

function RequestCard({ s }: { s: PromptSuggestion }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<AdminPromptActionState>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <li className="border-2 border-ink bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-paper px-4 py-2.5">
        <span className="text-sm font-bold text-ink">{s.tenantName ?? "Tenant"}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{s.agentName}</span>
        <span className="border-2 border-ink bg-brut-violet px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">{s.reason}</span>
        <span className="font-mono text-xs font-bold tabular-nums text-ink/70">{s.reasonCount} calls</span>
        <DeltaChip deltaPct={s.reasonDeltaPct} />
        {s.status === "requested" ? (
          <span className="border-2 border-ink bg-brut-cyan px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">Tenant-raised</span>
        ) : (
          <span className="border-2 border-ink bg-brut-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">Auto-detected</span>
        )}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-gray-500">
          {s.status === "requested" ? `Raised ${when(s.requestedAt)}` : `Detected ${when(s.createdAt)}`}
        </span>
      </div>

      <div className="space-y-3 px-4 py-3">
        {s.operatorNote ? (
          <div className="border-l-[3px] border-ink bg-brut-yellow/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/70">Operator note</p>
            <p className="text-sm text-ink">{s.operatorNote}</p>
          </div>
        ) : null}
        {s.rationale ? <p className="max-w-prose text-sm leading-relaxed text-gray-700">{s.rationale}</p> : null}

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Prompt change</p>
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

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-gray-100 pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => applyPromptSuggestion({ suggestionId: s.id }))}
            className="brut-press brut-focus inline-flex h-10 items-center border-[3px] border-ink bg-brut-lime px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut disabled:opacity-50"
          >
            Apply to Vapi
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => declinePromptSuggestion({ suggestionId: s.id }))}
            className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
          >
            Decline
          </button>
          {msg ? <span className="text-xs font-semibold text-brut-red">{msg}</span> : null}
        </div>
      </div>
    </li>
  );
}

function RevisionRowItem({ r }: { r: PromptRevision }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const worse = r.measuredFlaggedRate != null && r.baselineFlaggedRate != null && r.measuredFlaggedRate > r.baselineFlaggedRate;

  return (
    <li className="flex flex-wrap items-center gap-2 border-2 border-ink bg-paper px-4 py-2.5">
      <span className="border border-ink bg-gray-100 px-1.5 text-[10px] font-bold uppercase text-ink">r{r.revision}</span>
      <span className="text-sm font-bold text-ink">{r.tenantName ?? "Tenant"}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{r.agentName}</span>
      {r.reason ? <span className="border-2 border-ink bg-brut-violet px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">{r.reason}</span> : null}
      <span className="font-mono text-[11px] tabular-nums text-gray-500">
        baseline {pct(r.baselineFlaggedRate)} → measured <span className={worse ? "font-bold text-brut-red" : "text-ink"}>{pct(r.measuredFlaggedRate)}</span>
      </span>
      <span className="ml-auto font-mono text-[11px] tabular-nums text-gray-500">{when(r.appliedAt)}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rollbackPromptRevision({ revisionId: r.id });
            setMsg(res.error ?? null);
            if (res.ok) router.refresh();
          })
        }
        className="brut-press brut-focus inline-flex h-8 items-center border-2 border-ink bg-brut-orange px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink disabled:opacity-50"
      >
        Roll back
      </button>
      {msg ? <span className="mt-1 w-full text-xs font-semibold text-brut-red">{msg}</span> : null}
    </li>
  );
}

export function PromptRequestBoard({ requests, revisions }: { requests: PromptSuggestion[]; revisions: PromptRevision[] }) {
  return (
    <div className="space-y-8">
      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-center justify-between border-b-[3px] border-ink bg-brut-violet px-5 py-3.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Suggestions awaiting approval</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{requests.length}</span>
        </header>
        {requests.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-600">No open prompt-tuning suggestions right now — the daily sweep auto-detects them and tenants can raise their own.</p>
        ) : (
          <ul className="space-y-4 p-4">{requests.map((s) => <RequestCard key={s.id} s={s} />)}</ul>
        )}
      </section>

      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-center justify-between border-b-[3px] border-ink bg-brut-cyan px-5 py-3.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Live revisions</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{revisions.length}</span>
        </header>
        {revisions.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-600">No applied prompt revisions yet.</p>
        ) : (
          <ul className="space-y-3 p-4">{revisions.map((r) => <RevisionRowItem key={r.id} r={r} />)}</ul>
        )}
      </section>
    </div>
  );
}
