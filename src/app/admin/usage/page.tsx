import { requireStaff } from "@/lib/admin/guard";
import { getUsageOverview } from "@/lib/admin/observability/service";

export const metadata = { title: "Usage & cost, Admin" };

export default async function UsagePage() {
  await requireStaff();
  const usage = await getUsageOverview();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Usage &amp; cost</h1>
      <p className="mb-4 text-sm text-gray-500">Metered feature usage per tenant for the current period.</p>
      <div className="space-y-4">
        {usage.length === 0 && <p className="text-sm text-gray-400">No metered usage recorded yet.</p>}
        {usage.map((t) => (
          <section key={t.tenantId} className="border-[3px] border-ink p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">{t.tenantName}{t.nearLimit && <span className="ml-2 rounded bg-brut-yellow/40 px-1.5 py-0.5 text-[11px] font-medium text-ink">near limit</span>}</h2>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50"><tr>{["Feature", "Used", "Limit", "Utilisation"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-bold text-gray-700">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {t.features.map((f) => (
                  <tr key={f.featureKey}>
                    <td className="px-3 py-1.5 text-gray-800">{f.featureKey}</td>
                    <td className="px-3 py-1.5 text-gray-700">{f.used.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-gray-500">{f.limit === null ? "∞" : f.limit.toLocaleString()}</td>
                    <td className="px-3 py-1.5"><span className={f.utilisationPct === null ? "text-gray-400" : f.utilisationPct >= 80 ? "text-brut-red-deep" : "text-gray-700"}>{f.utilisationPct === null ? "·" : `${f.utilisationPct}%`}</span></td>
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
