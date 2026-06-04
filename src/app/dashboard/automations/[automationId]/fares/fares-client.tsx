"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule { id: string; vehicle_type: string; base_fare: number; per_mile: number; per_min: number; min_fare: number; airport_surcharge: number; currency: string }

export function FaresClient(props: { orgId: string; automationId: string; rules: Rule[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = `/api/orgs/${props.orgId}/automations/${props.automationId}/fares`;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); }
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div>
      <table className="mb-4 min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Vehicle", "Base", "/mile", "/min", "Min", "Airport", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {props.rules.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No fare rules yet.</td></tr>}
          {props.rules.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 text-slate-800">{r.vehicle_type}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.base_fare).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.per_mile).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.per_min).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.min_fare).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.airport_surcharge).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{!props.isDemo && <button disabled={busy} onClick={() => call(`${base}/${r.id}`, "DELETE")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Delete</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
      {!props.isDemo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void call(base, "POST", {
              vehicle_type: f.get("vehicle_type"), base_fare: Number(f.get("base_fare")), per_mile: Number(f.get("per_mile")),
              per_min: Number(f.get("per_min")), min_fare: Number(f.get("min_fare")), airport_surcharge: Number(f.get("airport_surcharge")),
            });
            e.currentTarget.reset();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <input name="vehicle_type" required placeholder="saloon" className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" />
          {["base_fare", "per_mile", "per_min", "min_fare", "airport_surcharge"].map((n) => (
            <input key={n} name={n} type="number" step="0.01" defaultValue="0" placeholder={n} className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
          ))}
          <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save rule</button>
        </form>
      )}
    </div>
  );
}
