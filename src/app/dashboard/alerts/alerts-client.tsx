"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule { id: string; name: string; metric: string; operator: string; threshold: number; enabled: boolean }
interface Channel { id: string; type: string; destination: string; enabled: boolean }
interface Event { id: string; rule_id: string; value: number; fired_at: string }

export function AlertsClient(props: { orgId: string; rules: Rule[]; channels: Channel[]; events: Event[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); }
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Rules</h2>
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {props.rules.length === 0 && <li className="py-2 text-gray-400">No rules yet.</li>}
          {props.rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className="text-gray-800">{r.name} <span className="text-xs text-gray-400">({r.metric} {r.operator} {r.threshold})</span></span>
              <span className={r.enabled ? "text-xs text-emerald-600" : "text-xs text-gray-400"}>{r.enabled ? "On" : "Off"}</span>
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void post(`/api/orgs/${props.orgId}/alerts/rules`, {
                name: f.get("name"), metric: f.get("metric"), operator: f.get("operator"), threshold: Number(f.get("threshold")),
              });
              e.currentTarget.reset();
            }}
            className="flex flex-col gap-2"
          >
            <input name="name" required placeholder="Rule name" className="rounded border border-gray-300 px-2 py-1 text-sm" />
            <div className="flex gap-2">
              <select name="metric" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm">
                <option value="abandonment_rate">Abandonment rate</option>
                <option value="bookings_count">Bookings</option>
              </select>
              <select name="operator" className="rounded border border-gray-300 px-2 py-1 text-sm">
                <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
              </select>
              <input name="threshold" type="number" step="any" required placeholder="15" className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
            </div>
            <button disabled={busy} type="submit" className="self-start rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add rule</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Channels</h2>
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {props.channels.length === 0 && <li className="py-2 text-gray-400">No channels yet.</li>}
          {props.channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-gray-800">{c.type}: {c.destination}</span>
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void post(`/api/orgs/${props.orgId}/alerts/channels`, { type: f.get("type"), destination: f.get("destination") });
              e.currentTarget.reset();
            }}
            className="flex gap-2"
          >
            <select name="type" className="rounded border border-gray-300 px-2 py-1 text-sm">
              <option value="email">Email</option><option value="slack">Slack</option><option value="webhook">Webhook</option>
            </select>
            <input name="destination" required placeholder="ops@yourcab.co.uk" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 p-4 md:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent alerts</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {props.events.length === 0 && <li className="py-2 text-gray-400">No alerts fired yet.</li>}
          {props.events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between py-2">
              <span className="text-gray-700">value {ev.value}</span>
              <span className="text-xs text-gray-400">{new Date(ev.fired_at).toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
      </section>

      {err && <p className="md:col-span-2 text-sm text-red-600" role="alert">{err}</p>}
    </div>
  );
}
