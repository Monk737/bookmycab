import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { getHealth, listFailedDispatches } from "@/lib/dispatchops/service";
import { DispatchClient } from "./dispatch-client";

export const metadata = { title: "Dispatch — CabbyBot" };

export default async function DispatchPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "dispatch_retry"))) redirect("/dashboard");
  const [health, failures] = await Promise.all([getHealth(claims.tenant_id), listFailedDispatches(claims.tenant_id)]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Dispatch</h1>
      <p className="mb-4 text-sm text-slate-500">Adapter health and failed-dispatch recovery (last 24h).</p>
      <DispatchClient orgId={claims.tenant_id} health={health} failures={failures} isDemo={claims.is_demo} />
    </div>
  );
}
