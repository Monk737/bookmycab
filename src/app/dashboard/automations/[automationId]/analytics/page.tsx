import { requireUser } from "@/lib/auth/session";
import { getAutomationCards } from "@/lib/dashboard/queries";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const claims = await requireUser();
  const { automationId } = await params;

  if (!claims.tenant_id) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Unable to load analytics — no organisation found on your account.
      </div>
    );
  }

  const cards = await getAutomationCards(claims.tenant_id);
  const card = cards.find((c) => c.id === automationId);
  const isBooking = card?.type === "Booking";

  return (
    <AnalyticsClient
      orgId={claims.tenant_id}
      automationId={automationId}
      isBooking={isBooking}
    />
  );
}
