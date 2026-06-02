import { requireUser } from "@/lib/auth/session";
import { getConversationsPage } from "@/lib/dashboard/queries";
import { parseConversationFilter } from "@/lib/dashboard/bookings-filter";
import { ConversationsClient } from "./conversations-client";

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ automationId: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const claims = await requireUser();
  const { automationId } = await params;

  if (!claims.tenant_id) return null;

  const rawSp = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(rawSp)) {
    sp.set(k, Array.isArray(v) ? v[0] : v);
  }

  const filter = parseConversationFilter(sp);
  const { rows, total } = await getConversationsPage({ automationId, filter });

  return (
    <ConversationsClient
      orgId={claims.tenant_id}
      automationId={automationId}
      initialRows={rows}
      total={total}
      filterValues={Object.fromEntries(sp)}
    />
  );
}
