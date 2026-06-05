"use client";
import { useState } from "react";

interface Turn { id: string; question: string; answer: string; intent: string | null; created_at: string }
const SUGGESTIONS = ["How much revenue this month?", "How many bookings last week?", "What are my top destinations?", "Why are customers abandoning?"];

export function CopilotClient(props: { orgId: string; history: Turn[]; isDemo: boolean }) {
  const [turns, setTurns] = useState<{ q: string; a: string }[]>(
    [...props.history].reverse().map((t) => ({ q: t.question, a: t.answer })),
  );
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || props.isDemo) return;
    setBusy(true); setErr(null);
    setTurns((t) => [...t, { q: question, a: "…" }]);
    try {
      const res = await fetch(`/api/orgs/${props.orgId}/copilot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 429 ? "You've reached your copilot limit for this period." : typeof b.error === "string" ? b.error : `Failed (${res.status})`;
        setErr(msg);
        setTurns((t) => t.slice(0, -1));
      } else {
        setTurns((t) => [...t.slice(0, -1), { q: question, a: String(b.answer ?? "") }]);
      }
    } catch { setErr("Network error."); setTurns((t) => t.slice(0, -1)); } finally { setBusy(false); setQ(""); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 min-h-[200px] space-y-3 rounded-lg border border-gray-200 p-4">
        {turns.length === 0 && <p className="text-sm text-gray-400">Ask your first question below.</p>}
        {turns.map((t, i) => (
          <div key={i} className="space-y-1">
            <p className="text-sm font-medium text-gray-800">🧑 {t.q}</p>
            <p className="text-sm text-blue-800">🤖 {t.a}</p>
          </div>
        ))}
      </div>
      {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
      {props.isDemo ? <p className="text-sm text-gray-400">Disabled in demo.</p> : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your data…" className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "…" : "Ask"}</button>
          </form>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} disabled={busy} onClick={() => void ask(s)} className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">{s}</button>)}
          </div>
        </>
      )}
    </div>
  );
}
