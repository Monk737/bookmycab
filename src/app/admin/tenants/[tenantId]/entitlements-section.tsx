import { listFeatures, listTenantEntitlements } from "@/lib/admin/entitlements";
import { toggleTenantEntitlement, clearEntitlement } from "./entitlement-actions";

/** Per-tenant entitlement overrides. Server component; renders a toggle per feature. */
export async function EntitlementsSection({ tenantId }: { tenantId: string }) {
  const [features, overrides] = await Promise.all([listFeatures(), listTenantEntitlements(tenantId)]);
  const overrideMap = new Map(overrides.map((o) => [o.feature_key, o.enabled]));

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Entitlement overrides</h2>
      <p className="mb-3 text-xs text-slate-500">Overrides win over the tenant&apos;s plan. Unset = inherit plan.</p>
      <ul className="divide-y divide-slate-100">
        {features.map((f) => {
          const ov = overrideMap.get(f.key);
          const label = ov === undefined ? "Inherit" : ov ? "Forced on" : "Forced off";
          return (
            <li key={f.key} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-800">{f.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{label}</span>
                <form action={toggleTenantEntitlement} className="inline">
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="featureKey" value={f.key} />
                  <input type="hidden" name="enabled" value={(ov ? false : true).toString()} />
                  <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    {ov ? "Disable" : "Enable"}
                  </button>
                </form>
                {ov !== undefined && (
                  <form action={clearEntitlement} className="inline">
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <input type="hidden" name="featureKey" value={f.key} />
                    <button type="submit" className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50">
                      Inherit
                    </button>
                  </form>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
