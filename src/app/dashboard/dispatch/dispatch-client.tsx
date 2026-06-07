"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Health { adapter: string; total: number; succeeded: number; failed: number; successRate: number; p95LatencyMs: number | null }
interface Failure { booking_id: string | null; adapter: string; operation: string; error: string | null; attempt_no: number; created_at: string; passenger_name: string | null }

export function DispatchClient(props: { orgId: string; health: Health[]; failures: Failure[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function retry(bookingId: string) {
    setBusy(bookingId); setErr(null);
    try {
      const res = await fetch(`/api/orgs/${props.orgId}/dispatch/failures/${bookingId}/retry`, { method: "POST" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Retry failed (${res.status})`);
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.health.length === 0 && <p className="text-sm text-gray-400">No dispatch activity in the last 24h.</p>}
        {props.health.map((h) => (
          <div key={h.adapter} className="border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold capitalize text-gray-800">{h.adapter}</span>
              <span className={h.successRate >= 95 ? "text-sm font-medium text-ink" : h.successRate >= 80 ? "text-sm font-medium text-ink" : "text-sm font-medium text-brut-red-deep"}>{h.successRate}%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{h.succeeded}/{h.total} ok · {h.failed} failed · p95 {h.p95LatencyMs ?? "·"}ms</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-bold text-ink">Failed dispatches</h2>
      {err && <p className="mb-2 text-sm text-brut-red-deep" role="alert">{err}</p>}
      <table className="min-w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50"><tr>{["When", "Passenger", "Adapter", "Attempt", "Error", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {props.failures.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No failed dispatches 🎉</td></tr>}
          {props.failures.map((f, i) => (
            <tr key={`${f.booking_id}-${i}`}>
              <td className="px-3 py-2 text-gray-400">{new Date(f.created_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-gray-800">{f.passenger_name ?? "·"}</td>
              <td className="px-3 py-2 capitalize text-gray-600">{f.adapter}</td>
              <td className="px-3 py-2 text-gray-500">#{f.attempt_no}</td>
              <td className="px-3 py-2 text-brut-red-deep">{f.error ?? "·"}</td>
              <td className="px-3 py-2 text-right">
                {!props.isDemo && f.booking_id && <button disabled={busy === f.booking_id} onClick={() => retry(f.booking_id!)} className=" border-2 border-ink bg-brut-yellow shadow-brut-sm px-2 py-1 text-xs font-medium text-ink disabled:opacity-50">{busy === f.booking_id ? "Retrying…" : "Retry"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
