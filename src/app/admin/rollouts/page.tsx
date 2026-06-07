import { requireStaff } from "@/lib/admin/guard";
import { listRollouts } from "@/lib/admin/rollouts";
import { setRolloutAction } from "./actions";

export const metadata = { title: "Rollouts, Admin" };

const STRATEGIES = ["all", "percentage", "allowlist", "off"];

export default async function RolloutsPage() {
  await requireStaff();
  const rollouts = await listRollouts();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Feature rollouts</h1>
      <p className="mb-4 text-sm text-gray-500">Stage a feature to a % of tenants, restrict to an allowlist, or kill it instantly. Applies platform-wide within ~30s.</p>
      <div className="overflow-x-auto border-[3px] border-ink">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50"><tr>{["Feature", "Strategy", "%", "Kill", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rollouts.map((r) => (
              <tr key={r.featureKey} className={r.killSwitch || r.strategy === "off" ? "bg-brut-red/15" : ""}>
                <td className="px-3 py-2"><span className="font-medium text-gray-800">{r.name}</span><br /><span className="text-[11px] text-gray-400">{r.featureKey}</span></td>
                <td className="px-3 py-2" colSpan={3}>
                  <form action={setRolloutAction} className="flex items-center gap-2">
                    <input type="hidden" name="featureKey" value={r.featureKey} />
                    <select name="strategy" defaultValue={r.strategy} className="rounded border-[3px] border-ink px-2 py-1 text-xs">
                      {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input name="percentage" type="number" min={0} max={100} defaultValue={r.percentage} className="w-16 rounded border-[3px] border-ink px-2 py-1 text-xs" />
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="hidden" name="killSwitch" value="false" />
                      <input type="checkbox" name="killSwitch" value="true" defaultChecked={r.killSwitch} /> kill
                    </label>
                    <button type="submit" className="rounded border-2 border-ink bg-brut-yellow shadow-brut-sm px-2 py-1 text-xs font-medium text-ink">Save</button>
                  </form>
                </td>
                <td className="px-3 py-2 text-right">{r.killSwitch ? <span className="text-xs font-medium text-brut-red-deep">KILLED</span> : r.strategy === "off" ? <span className="text-xs text-gray-400">off</span> : <span className="text-xs text-ink">live</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
