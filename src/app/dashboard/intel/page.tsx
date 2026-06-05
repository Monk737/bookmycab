import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listFlagged } from "@/lib/convintel/service";
import { IntelClient } from "./intel-client";

export const metadata = { title: "Intelligence — BookMyCab" };

export default async function IntelPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "conversation_intelligence"))) redirect("/dashboard");
  const flagged = await listFlagged(claims.tenant_id);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Conversation intelligence</h1>
      <p className="mb-4 text-sm text-slate-500">Search transcripts, review QA scores, and flag conversations for coaching.</p>
      <IntelClient orgId={claims.tenant_id} initialFlagged={flagged} isDemo={claims.is_demo} />
    </div>
  );
}
