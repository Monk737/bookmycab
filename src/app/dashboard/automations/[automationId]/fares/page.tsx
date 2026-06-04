import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listFareRules } from "@/lib/config/fare-queries";
import { FaresClient } from "./fares-client";

export const metadata = { title: "Fares — CabbyBot" };

export default async function FaresPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "fare_rules"))) redirect(`/dashboard/automations/${automationId}`);
  const rules = await listFareRules(claims.tenant_id, automationId);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Fare rules</h1>
      <p className="mb-4 text-sm text-slate-500">Per-vehicle pricing the bot quotes.</p>
      <FaresClient orgId={claims.tenant_id} automationId={automationId} rules={rules} isDemo={claims.is_demo} />
    </div>
  );
}
