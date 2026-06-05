import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listTenantChannels } from "@/lib/channels/service";
import { ConnectClient } from "./connect-client";

export const metadata = { title: "Connect a channel — CabbyBot" };

function svc() { return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY); }

export default async function ConnectPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "self_serve_channels"))) redirect("/dashboard");
  const [channels, { data: automations }] = await Promise.all([
    listTenantChannels(claims.tenant_id),
    svc().from("automations").select("id, name").eq("tenant_id", claims.tenant_id).order("name"),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Connect a channel</h1>
      <p className="mb-4 text-sm text-slate-500">Request a new channel; our team reviews and activates it.</p>
      <ConnectClient orgId={claims.tenant_id} channels={channels} automations={(automations ?? []) as { id: string; name: string }[]} isDemo={claims.is_demo} />
    </div>
  );
}
