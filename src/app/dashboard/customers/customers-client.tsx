"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Customer {
  id: string; customer_handle: string; name: string | null; total_bookings: number;
  total_spend: number; preferred_vehicle: string | null; vip: boolean; blocked: boolean; last_seen: string | null;
}

export function CustomersClient(props: { orgId: string; customers: Customer[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      <div className="mb-3 flex items-center gap-2">
        {!props.isDemo && (
          <button disabled={busy} onClick={() => call(`/api/orgs/${props.orgId}/customers`, "POST")} className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Refresh from bookings
          </button>
        )}
        {err && <span className="text-sm text-red-600" role="alert">{err}</span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Customer", "Handle", "Bookings", "Spend", "Preferred", "Flags", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.customers.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No customers yet — click &ldquo;Refresh from bookings&rdquo;.</td></tr>
            )}
            {props.customers.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 text-slate-800">{c.name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-500">{c.customer_handle}</td>
                <td className="px-3 py-2 text-slate-700">{c.total_bookings}</td>
                <td className="px-3 py-2 text-slate-700">£{Number(c.total_spend).toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-500">{c.preferred_vehicle ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.vip && <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">VIP</span>}
                  {c.blocked && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700">Blocked</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {!props.isDemo && (
                    <span className="flex justify-end gap-1">
                      <button disabled={busy} onClick={() => call(`/api/orgs/${props.orgId}/customers/${c.id}`, "PATCH", { vip: !c.vip })} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">{c.vip ? "Unset VIP" : "VIP"}</button>
                      <button disabled={busy} onClick={() => call(`/api/orgs/${props.orgId}/customers/${c.id}`, "PATCH", { blocked: !c.blocked })} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">{c.blocked ? "Unblock" : "Block"}</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
