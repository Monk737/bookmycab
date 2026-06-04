import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listActiveConversations } from "@/lib/liveops/service";
import { LiveopsClient } from "./liveops-client";

export const metadata = { title: "Live ops — CabbyBot" };

export default async function LiveopsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "live_takeover"))) redirect("/dashboard");
  const conversations = await listActiveConversations(claims.tenant_id);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Live ops</h1>
      <p className="mb-4 text-sm text-slate-500">Watch live conversations and take over from the bot.</p>
      <LiveopsClient orgId={claims.tenant_id} conversations={conversations} isDemo={claims.is_demo} />
    </div>
  );
}
