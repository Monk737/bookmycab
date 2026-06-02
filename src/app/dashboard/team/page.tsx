import { requireUser } from "@/lib/auth/session";
import { listMembers } from "@/lib/dashboard/team-queries";
import { listAudit } from "@/lib/dashboard/team-queries";
import { getAutomationCards } from "@/lib/dashboard/queries";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { TeamClient } from "./team-client";

export default async function TeamPage() {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <main className="p-8">
        <p className="text-slate-500 text-sm">No organisation found for your account.</p>
      </main>
    );
  }

  const isOwner = claims.role === "Owner";

  const [members, automationCards] = await Promise.all([
    listMembers(claims.tenant_id),
    getAutomationCards(claims.tenant_id),
  ]);

  // Service-role read: audit_log RLS denies tenant SELECT (migrations 0005/0011).
  // This is the documented exception — only Owners can see the audit trail, and
  // we use the service-role client (never exposed to the browser) solely for this query.
  let audit: Awaited<ReturnType<typeof listAudit>> = [];
  if (isOwner) {
    const svc = createSupabaseJS(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
    audit = await listAudit(claims.tenant_id, 50, svc);
  }

  return (
    <TeamClient
      orgId={claims.tenant_id}
      isOwner={isOwner}
      members={members}
      automations={automationCards.map((a) => ({ id: a.id, name: a.name }))}
      audit={audit}
    />
  );
}
