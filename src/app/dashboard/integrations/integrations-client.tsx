"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Key { id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null }
interface Hook { id: string; url: string; events: string[]; enabled: boolean; failure_count: number }
const EVENTS = ["booking.created", "booking.cancelled", "conversation.ended", "*"];

export function IntegrationsClient(props: { orgId: string; keys: Key[]; webhooks: Hook[]; canWebhooks: boolean; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/integrations`;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [evs, setEvs] = useState<string[]>([]);

  async function call(url: string, method: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); return null; }
      router.refresh();
      return b;
    } catch { setErr("Network error."); return null; } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">API keys</h2>
        {issued && (
          <div className="mb-3  border border-ink bg-brut-yellow/30 p-2 text-xs text-ink">
            Copy your key now, it won&apos;t be shown again:<br /><code className="break-all font-mono">{issued}</code>
          </div>
        )}
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {props.keys.length === 0 && <li className="py-2 text-gray-400">No keys yet.</li>}
          {props.keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-2">
              <span className="text-gray-800">{k.name} <span className="font-mono text-xs text-gray-400">{k.prefix}…</span> {k.revoked_at && <span className="text-xs text-brut-red-deep">revoked</span>}</span>
              {!props.isDemo && !k.revoked_at && <button disabled={busy} onClick={() => call(`${base}/keys/${k.id}`, "DELETE")} className=" border-[3px] border-ink px-2 py-1 text-xs text-gray-700">Revoke</button>}
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const b = await call(`${base}/keys`, "POST", { name: f.get("name") }); if (b && typeof b.raw === "string") setIssued(b.raw); e.currentTarget.reset(); }} className="flex gap-2">
            <input name="name" required placeholder="Key name" className="flex-1  border-[3px] border-ink px-2 py-1 text-sm" />
            <button disabled={busy} type="submit" className=" border-2 border-ink bg-brut-yellow shadow-brut-sm px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">Issue key</button>
          </form>
        )}
      </section>

      <section className="border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">Outbound webhooks</h2>
        {err && <p className="mb-2 text-sm text-brut-red-deep" role="alert">{err}</p>}
        {!props.canWebhooks ? <p className="text-sm text-gray-400">Webhooks aren&apos;t on your plan.</p> : (
          <>
            <ul className="mb-3 divide-y divide-gray-100 text-sm">
              {props.webhooks.length === 0 && <li className="py-2 text-gray-400">No webhooks yet.</li>}
              {props.webhooks.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <span className="text-gray-800"><span className="break-all">{h.url}</span> <span className="text-xs text-gray-400">{h.events.join(", ")}</span></span>
                  {!props.isDemo && <button disabled={busy} onClick={() => call(`${base}/webhooks/${h.id}`, "DELETE")} className=" border-[3px] border-ink px-2 py-1 text-xs text-gray-700">Delete</button>}
                </li>
              ))}
            </ul>
            {!props.isDemo && (
              <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (evs.length) { void call(`${base}/webhooks`, "POST", { url: f.get("url"), events: evs }); e.currentTarget.reset(); setEvs([]); } }} className="space-y-2">
                <input name="url" type="url" required placeholder="https://your-system/webhook" className="w-full  border-[3px] border-ink px-2 py-1 text-sm" />
                <div className="flex flex-wrap gap-2 text-xs">
                  {EVENTS.map((ev) => <label key={ev} className="flex items-center gap-1"><input type="checkbox" checked={evs.includes(ev)} onChange={(e) => setEvs((s) => e.target.checked ? [...s, ev] : s.filter((x) => x !== ev))} /> {ev}</label>)}
                </div>
                <button disabled={busy} type="submit" className=" border-2 border-ink bg-brut-yellow shadow-brut-sm px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">Add webhook</button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
