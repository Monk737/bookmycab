import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listDefinitions, listRuns, getBranding } from "@/lib/reporting/service";
import { ReportsClient } from "./reports-client";

export const metadata = { title: "Reports, BookMyCab" };

export default async function ReportsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "scheduled_reports"))) redirect("/dashboard");
  const canBrand = await hasFeature(claims.tenant_id, "white_label");
  const [definitions, runs, branding] = await Promise.all([
    listDefinitions(claims.tenant_id),
    listRuns(claims.tenant_id),
    getBranding(claims.tenant_id),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Reports</h1>
      <p className="mb-4 text-sm text-gray-500">Define reports, run them on demand, and brand the output.</p>
      <ReportsClient orgId={claims.tenant_id} definitions={definitions} runs={runs} branding={branding} canBrand={canBrand} isDemo={claims.is_demo} />
    </div>
  );
}
