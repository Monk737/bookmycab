"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Conv { id: string; customer_handle: string; customer_name: string | null; outcome: string | null; qa_score: number | null; qa_flags: unknown; flagged_for_review: boolean; started_at: string }

export function IntelClient(props: { orgId: string; initialFlagged: Conv[]; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/intel`;
  const [rows, setRows] = useState<Conv[]>(props.initialFlagged);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(url: string, method = "GET", body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); return null; }
      return b;
    } catch { setErr("Network error."); return null; } finally { setBusy(false); }
  }
  async function search() { const b = await run(`${base}/search?q=${encodeURIComponent(q)}`); if (b) setRows(b.conversations ?? []); }
  async function analyze() { await run(`${base}/analyze`, "POST"); router.refresh(); }
  async function flag(id: string, flagged: boolean) { await run(`${base}/${id}/flag`, "POST", { flagged }); const b = await run(`${base}/search?q=${encodeURIComponent(q)}`); if (b) setRows(b.conversations ?? []); }

  function flagList(f: unknown): string { return Array.isArray(f) ? (f as string[]).join(", ") : ""; }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="Search transcripts…" className="w-64 rounded border border-gray-300 px-2 py-1 text-sm" />
        <button disabled={busy} onClick={() => void search()} className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Search</button>
        {!props.isDemo && <button disabled={busy} onClick={() => void analyze()} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">Re-score recent</button>}
        <span className="text-xs text-gray-400">{q.trim() ? "search results" : "flagged for review"}</span>
        {err && <span className="text-sm text-red-600" role="alert">{err}</span>}
      </div>
      <table className="min-w-full rounded-lg border border-gray-200 text-sm">
        <thead className="bg-gray-50"><tr>{["Customer", "Outcome", "QA", "Flags", "When", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Nothing to show.</td></tr>}
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-gray-800">{c.customer_name ?? c.customer_handle}</td>
              <td className="px-3 py-2 text-gray-500">{c.outcome ?? "—"}</td>
              <td className="px-3 py-2"><span className={c.qa_score == null ? "text-gray-400" : c.qa_score >= 80 ? "text-emerald-600" : c.qa_score >= 60 ? "text-amber-600" : "text-red-600"}>{c.qa_score ?? "—"}</span></td>
              <td className="px-3 py-2 text-xs text-gray-500">{flagList(c.qa_flags)}</td>
              <td className="px-3 py-2 text-gray-400">{new Date(c.started_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-right">{!props.isDemo && <button disabled={busy} onClick={() => void flag(c.id, !c.flagged_for_review)} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">{c.flagged_for_review ? "Unflag" : "Flag"}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
