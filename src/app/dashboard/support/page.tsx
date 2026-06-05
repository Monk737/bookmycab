import { requireUser } from "@/lib/auth/session";
import { listTickets } from "@/lib/dashboard/support-queries";
import { SupportClient } from "./support-client";

export default async function SupportPage() {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">No organisation found for your account.</p>
      </main>
    );
  }

  const tickets = await listTickets(claims.tenant_id);

  return <SupportClient orgId={claims.tenant_id} initialTickets={tickets} />;
}
