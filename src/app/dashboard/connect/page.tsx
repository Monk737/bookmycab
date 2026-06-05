import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listTenantChannels, listTenantAutomations } from "@/lib/channels/service";
import { ConnectClient } from "./connect-client";

export const metadata = { title: "Connect a channel — BookMyCab" };

export default async function ConnectPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "self_serve_channels"))) redirect("/dashboard");
  const [channels, automations] = await Promise.all([
    listTenantChannels(claims.tenant_id),
    listTenantAutomations(claims.tenant_id),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Connect a channel</h1>
      <p className="mb-4 text-sm text-slate-500">Request a new channel; our team reviews and activates it.</p>
      <ConnectClient orgId={claims.tenant_id} channels={channels} automations={automations} isDemo={claims.is_demo} />
    </div>
  );
}
