import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listKeys, listWebhooks } from "@/lib/integrations/service";
import { IntegrationsClient } from "./integrations-client";

export const metadata = { title: "Integrations, BookMyCab" };

export default async function IntegrationsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "api_access"))) redirect("/dashboard");
  const canWebhooks = await hasFeature(claims.tenant_id, "outbound_webhooks");
  const [keys, webhooks] = await Promise.all([
    listKeys(claims.tenant_id),
    canWebhooks ? listWebhooks(claims.tenant_id) : Promise.resolve([]),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Integrations</h1>
      <p className="mb-4 text-sm text-gray-500">API keys and outbound webhooks for your own systems.</p>
      <IntegrationsClient orgId={claims.tenant_id} keys={keys} webhooks={webhooks} canWebhooks={canWebhooks} isDemo={claims.is_demo} />
    </div>
  );
}
