import { requireStaff } from "@/lib/admin/guard";
import { listSnapshots } from "@/lib/admin/benchmarks";
import { recomputeAction } from "./actions";

export const metadata = { title: "Benchmarks, Admin" };

export default async function BenchmarksPage() {
  await requireStaff();
  const snapshots = await listSnapshots();
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Network benchmarks</h1>
          <p className="text-sm text-gray-500">Anonymised p25/p50/p75 across opted-in tenants (last 30 days).</p>
        </div>
        <form action={recomputeAction}><button type="submit" className="rounded border-2 border-ink bg-brut-yellow shadow-brut-sm px-3 py-1.5 text-sm font-medium text-ink">Recompute</button></form>
      </div>
      <table className="min-w-full border-[3px] border-ink text-sm">
        <thead className="bg-gray-50"><tr>{["Metric", "p25", "Median", "p75", "Sample", "Computed"].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {snapshots.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No snapshots yet, click Recompute.</td></tr>}
          {snapshots.map((s) => (
            <tr key={s.metric}>
              <td className="px-3 py-2 font-medium text-gray-800">{s.metric}</td>
              <td className="px-3 py-2 text-gray-600">{s.p25 ?? "·"}</td>
              <td className="px-3 py-2 font-bold text-ink">{s.p50 ?? "·"}</td>
              <td className="px-3 py-2 text-gray-600">{s.p75 ?? "·"}</td>
              <td className="px-3 py-2 text-gray-500">{s.sample_size}</td>
              <td className="px-3 py-2 text-gray-400">{new Date(s.computed_at).toLocaleString("en-GB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
