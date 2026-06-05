import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listHistory } from "@/lib/copilot/service";
import { CopilotClient } from "./copilot-client";

export const metadata = { title: "Copilot — CabbyBot" };

export default async function CopilotPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "ai_copilot"))) redirect("/dashboard");
  const history = await listHistory(claims.tenant_id, 10);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Copilot</h1>
      <p className="mb-4 text-sm text-slate-500">Ask questions about your bookings and conversations.</p>
      <CopilotClient orgId={claims.tenant_id} history={history} isDemo={claims.is_demo} />
    </div>
  );
}
