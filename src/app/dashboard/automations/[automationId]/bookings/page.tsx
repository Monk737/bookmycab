import { requireUser } from "@/lib/auth/session";
import { getBookingsPage } from "@/lib/dashboard/queries";
import { parseBookingFilter } from "@/lib/dashboard/bookings-filter";
import { BookingsClient } from "./bookings-client";

export default async function BookingsPage({
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

  const filter = parseBookingFilter(sp);
  const { rows, total } = await getBookingsPage({ automationId, filter });

  const canEdit = claims.role === "Owner" || claims.role === "Admin";

  return (
    <BookingsClient
      orgId={claims.tenant_id}
      automationId={automationId}
      initialRows={rows}
      total={total}
      filterValues={Object.fromEntries(sp)}
      canEdit={canEdit}
    />
  );
}
