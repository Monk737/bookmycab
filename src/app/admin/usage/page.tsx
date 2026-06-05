import { requireStaff } from "@/lib/admin/guard";
import { getUsageOverview } from "@/lib/admin/observability/service";

export const metadata = { title: "Usage & cost — Admin" };

export default async function UsagePage() {
  await requireStaff();
  const usage = await getUsageOverview();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Usage &amp; cost</h1>
      <p className="mb-4 text-sm text-slate-500">Metered feature usage per tenant for the current period.</p>
      <div className="space-y-4">
        {usage.length === 0 && <p className="text-sm text-slate-400">No metered usage recorded yet.</p>}
        {usage.map((t) => (
          <section key={t.tenantId} className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{t.tenantName}{t.nearLimit && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">near limit</span>}</h2>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50"><tr>{["Feature", "Used", "Limit", "Utilisation"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {t.features.map((f) => (
                  <tr key={f.featureKey}>
                    <td className="px-3 py-1.5 text-slate-800">{f.featureKey}</td>
                    <td className="px-3 py-1.5 text-slate-700">{f.used.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-slate-500">{f.limit === null ? "∞" : f.limit.toLocaleString()}</td>
                    <td className="px-3 py-1.5"><span className={f.utilisationPct === null ? "text-slate-400" : f.utilisationPct >= 80 ? "text-red-600" : "text-slate-700"}>{f.utilisationPct === null ? "—" : `${f.utilisationPct}%`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
