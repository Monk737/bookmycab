import { requireStaff } from "@/lib/admin/guard";
import { listPlans, listFeatures, listPlanFeatures } from "@/lib/admin/entitlements";
import { togglePlanFeature } from "./actions";

export const metadata = { title: "Plans, Admin" };

export default async function PlansPage() {
  await requireStaff();
  const [plans, features] = await Promise.all([listPlans(), listFeatures()]);
  const planFeatures = await Promise.all(plans.map((p) => listPlanFeatures(p.id)));
  const enabledSet = plans.map((_, i) => new Set(planFeatures[i].filter((f) => f.enabled).map((f) => f.feature_key)));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold text-ink">Plans &amp; feature packaging</h1>
      <div className="overflow-x-auto border-[3px] border-ink">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-gray-700">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center font-bold text-gray-700">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {features.map((f) => (
              <tr key={f.key}>
                <td className="px-3 py-2 text-gray-800">{f.name}{f.metered ? <span className="ml-1 text-[11px] text-ink">metered</span> : null}</td>
                {plans.map((p, i) => {
                  const on = enabledSet[i].has(f.key);
                  return (
                    <td key={p.id} className="px-3 py-2 text-center">
                      <form action={togglePlanFeature} className="inline">
                        <input type="hidden" name="planId" value={p.id} />
                        <input type="hidden" name="featureKey" value={f.key} />
                        <input type="hidden" name="enabled" value={(!on).toString()} />
                        <button type="submit" className={on ? "rounded bg-brut-lime/40 px-2 py-1 text-xs font-medium text-ink" : "rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400"}>
                          {on ? "On" : "Off"}
                        </button>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
