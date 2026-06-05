"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Channel { id: string; type: string; external_id: string | null; status: string; provisioning_status: string; is_self_serve: boolean; automation_id: string }
interface Automation { id: string; name: string }
const TYPES = ["whatsapp", "telegram", "messenger", "instagram", "widget"];

export function ConnectClient(props: { orgId: string; channels: Channel[]; automations: Automation[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoName = new Map(props.automations.map((a) => [a.id, a.name]));

  async function request(form: HTMLFormElement) {
    const f = new FormData(form);
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/orgs/${props.orgId}/channels/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: f.get("type"), externalId: f.get("externalId"), automationId: f.get("automationId") }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? `${b.error}${Array.isArray(b.fields) && b.fields.length ? ` (${b.fields.join(", ")})` : ""}` : `Failed (${res.status})`);
      else { form.reset(); router.refresh(); }
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  function badge(s: string) {
    const cls = s === "approved" ? "bg-emerald-100 text-emerald-700" : s === "pending_review" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{s.replace("_", " ")}</span>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Your channels</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {props.channels.length === 0 && <li className="py-2 text-slate-400">No channels yet.</li>}
          {props.channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800 capitalize">{c.type} <span className="text-xs text-slate-400">{c.external_id ?? ""} · {autoName.get(c.automation_id) ?? ""}</span></span>
              {badge(c.provisioning_status)}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Request a channel</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        {props.isDemo ? <p className="text-sm text-slate-400">Disabled in demo.</p> : (
          <form onSubmit={(e) => { e.preventDefault(); void request(e.currentTarget); }} className="space-y-2">
            <select name="type" className="w-full rounded border border-slate-300 px-2 py-1 text-sm">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <input name="externalId" required placeholder="Number / handle / widget id" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <select name="automationId" required className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="">Choose automation…</option>
              {props.automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Request channel</button>
          </form>
        )}
      </section>
    </div>
  );
}
