"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Def { id: string; name: string; metrics: unknown; format: string; white_label: boolean; enabled: boolean }
interface Run { id: string; report_id: string | null; status: string; generated_at: string }
interface Branding { logoUrl: string | null; primary: string; accent: string }
const METRICS = [{ k: "revenue", l: "Revenue & completion" }, { k: "bookings", l: "Bookings" }, { k: "response_time", l: "Response time" }];

export function ReportsClient(props: { orgId: string; definitions: Def[]; runs: Run[]; branding: Branding; canBrand: boolean; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/reports`;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Report definitions</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.definitions.length === 0 && <li className="py-2 text-slate-400">No reports yet.</li>}
          {props.definitions.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{d.name} <span className="text-xs text-slate-400">· {Array.isArray(d.metrics) ? (d.metrics as string[]).join(", ") : ""}</span></span>
              {!props.isDemo && (
                <span className="flex gap-1">
                  <button disabled={busy} onClick={() => call(`${base}/${d.id}`, "POST")} className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Run</button>
                  <button disabled={busy} onClick={() => call(`${base}/${d.id}`, "DELETE")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Delete</button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (sel.length) { void call(base, "POST", { name: f.get("name"), metrics: sel }); e.currentTarget.reset(); setSel([]); } }} className="space-y-2">
            <input name="name" required placeholder="Report name" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <div className="flex flex-wrap gap-2 text-xs">
              {METRICS.map((m) => (
                <label key={m.k} className="flex items-center gap-1">
                  <input type="checkbox" checked={sel.includes(m.k)} onChange={(e) => setSel((s) => e.target.checked ? [...s, m.k] : s.filter((x) => x !== m.k))} /> {m.l}
                </label>
              ))}
            </div>
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Create report</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent runs</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {props.runs.length === 0 && <li className="py-2 text-slate-400">No runs yet.</li>}
          {props.runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className={r.status === "success" ? "text-emerald-600" : "text-red-600"}>{r.status}</span>
              <span className="text-xs text-slate-400">{new Date(r.generated_at).toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
        {props.canBrand && !props.isDemo && (
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void call(`${base}/branding`, "PATCH", { logoUrl: f.get("logoUrl"), primary: f.get("primary"), accent: f.get("accent") }); }} className="space-y-2 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-700">White-label branding</h3>
            <input name="logoUrl" defaultValue={props.branding.logoUrl ?? ""} placeholder="Logo URL" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <div className="flex gap-2">
              <input name="primary" defaultValue={props.branding.primary} className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" />
              <input name="accent" defaultValue={props.branding.accent} className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" />
              <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save branding</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
