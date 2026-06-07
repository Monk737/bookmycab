import { listFeatures, listTenantEntitlements } from "@/lib/admin/entitlements";
import { toggleTenantEntitlement, clearEntitlement } from "./entitlement-actions";

/** Per-tenant entitlement overrides. Server component; renders a toggle per feature. */
export async function EntitlementsSection({ tenantId }: { tenantId: string }) {
  const [features, overrides] = await Promise.all([listFeatures(), listTenantEntitlements(tenantId)]);
  const overrideMap = new Map(overrides.map((o) => [o.feature_key, o.enabled]));

  return (
    <section className="border-[3px] border-ink p-4">
      <h2 className="mb-1 text-sm font-bold text-ink">Entitlement overrides</h2>
      <p className="mb-3 text-xs text-gray-500">Overrides win over the tenant&apos;s plan. Unset = inherit plan.</p>
      <ul className="divide-y divide-gray-100">
        {features.map((f) => {
          const ov = overrideMap.get(f.key);
          const label = ov === undefined ? "Inherit" : ov ? "Forced on" : "Forced off";
          return (
            <li key={f.key} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-800">{f.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{label}</span>
                <form action={toggleTenantEntitlement} className="inline">
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="featureKey" value={f.key} />
                  <input type="hidden" name="enabled" value={(ov ? false : true).toString()} />
                  <button type="submit" className="rounded border-[3px] border-ink px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    {ov ? "Disable" : "Enable"}
                  </button>
                </form>
                {ov !== undefined && (
                  <form action={clearEntitlement} className="inline">
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <input type="hidden" name="featureKey" value={f.key} />
                    <button type="submit" className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50">
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
