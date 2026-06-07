import { requireUser } from "@/lib/auth/session";
import { getAutomationConfig } from "@/lib/dashboard/config-queries";
import { getAutomationCards } from "@/lib/dashboard/queries";
import { ConfigForm } from "./config-form";

export default async function ConfigPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const claims = await requireUser();
  const { automationId } = await params;

  if (!claims.tenant_id) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Unable to load configuration, no organisation found on your account.
      </div>
    );
  }

  const [config, cards] = await Promise.all([
    getAutomationConfig(automationId),
    getAutomationCards(claims.tenant_id),
  ]);

  const card = cards.find((c) => c.id === automationId);
  const canEdit = claims.role === "Owner" || claims.role === "Admin";

  return (
    <ConfigForm
      orgId={claims.tenant_id}
      automationId={automationId}
      initialConfig={config}
      channels={card?.channels ?? []}
      canEdit={canEdit}
    />
  );
}
