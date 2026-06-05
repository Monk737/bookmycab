import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listRules, listChannels, listRecentEvents } from "@/lib/alerting/queries";
import { AlertsClient } from "./alerts-client";

export const metadata = { title: "Alerts — BookMyCab" };

export default async function AlertsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "alerting"))) redirect("/dashboard");

  const [rules, channels, events] = await Promise.all([
    listRules(claims.tenant_id),
    listChannels(claims.tenant_id),
    listRecentEvents(claims.tenant_id),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Alerts</h1>
      <p className="mb-4 text-sm text-gray-500">Get notified when your bot&apos;s metrics cross a threshold.</p>
      <AlertsClient orgId={claims.tenant_id} rules={rules} channels={channels} events={events} isDemo={claims.is_demo} />
    </div>
  );
}
