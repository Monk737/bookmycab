import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { listGuardrails } from "@/lib/config/guardrail-queries";
import { setGuardrailAction } from "./actions";

export const metadata = { title: "Guardrails — Admin" };

const FIELDS = ["service_area", "vehicle_types", "opening_hours", "languages", "ask_driver_note"];

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function GuardrailsPage() {
  await requireStaff();
  const { data: automations } = await svc().from("automations").select("id, name, tenant_id").order("created_at", { ascending: false }).limit(50);
  const rows = automations ?? [];
  const guardrailSets = await Promise.all(rows.map((a) => listGuardrails(a.id as string)));

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Config guardrails</h1>
      <p className="mb-4 text-sm text-slate-500">Lock fields or bound numeric values. Enforced when a tenant publishes a config version.</p>
      <div className="space-y-6">
        {rows.map((a, i) => {
          const gMap = new Map(guardrailSets[i].map((g) => [g.field, g]));
          return (
            <section key={a.id as string} className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">{a.name as string}</h2>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {FIELDS.map((field) => {
                    const g = gMap.get(field);
                    return (
                      <tr key={field}>
                        <td className="py-2 pr-4 text-slate-700">{field}</td>
                        <td className="py-2">
                          <form action={setGuardrailAction} className="flex items-center gap-2">
                            <input type="hidden" name="automationId" value={a.id as string} />
                            <input type="hidden" name="field" value={field} />
                            <label className="flex items-center gap-1 text-xs text-slate-600">
                              <input type="hidden" name="locked" value="false" />
                              <input type="checkbox" name="locked" value="true" defaultChecked={g?.locked ?? false} /> locked
                            </label>
                            <input name="minValue" placeholder="min" defaultValue={g?.min_value ?? ""} className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                            <input name="maxValue" placeholder="max" defaultValue={g?.max_value ?? ""} className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                            <button type="submit" className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Save</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
