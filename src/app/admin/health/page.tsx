import { requireStaff } from "@/lib/admin/guard";
import { getPlatformHealth } from "@/lib/admin/observability/service";

export const metadata = { title: "Platform health — Admin" };

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${c}`}>{value}</p>
    </div>
  );
}

function tone(pct: number): "good" | "warn" | "bad" {
  return pct >= 95 ? "good" : pct >= 80 ? "warn" : "bad";
}

export default async function HealthPage() {
  await requireStaff();
  const h = await getPlatformHealth();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Platform health</h1>
      <p className="mb-4 text-sm text-slate-500">Aggregated across all tenants (last 7 days).</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Automation success" value={`${h.automations.successRate}%`} tone={tone(h.automations.successRate)} />
        <Stat label="Automation runs" value={h.automations.total.toLocaleString()} />
        <Stat label="Notification deliverability" value={`${h.notifications.deliveredRate}%`} tone={tone(h.notifications.deliveredRate)} />
      </div>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Dispatch adapters</h2>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Adapter", "Attempts", "Success rate"].map((x) => <th key={x} className="px-3 py-2 text-left font-semibold text-slate-700">{x}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {h.dispatch.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400">No dispatch activity.</td></tr>}
          {h.dispatch.map((d) => (
            <tr key={d.adapter}>
              <td className="px-3 py-2 capitalize text-slate-800">{d.adapter}</td>
              <td className="px-3 py-2 text-slate-600">{d.total}</td>
              <td className="px-3 py-2"><span className={d.successRate >= 95 ? "text-emerald-600" : d.successRate >= 80 ? "text-amber-600" : "text-red-600"}>{d.successRate}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
