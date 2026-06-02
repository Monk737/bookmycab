import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBookingsPage } from "@/lib/dashboard/queries";
import { parseBookingFilter } from "@/lib/dashboard/bookings-filter";

export async function GET(req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const filter = parseBookingFilter(new URL(req.url).searchParams);
  const { rows, total } = await getBookingsPage({ automationId, filter });
  return NextResponse.json({ rows, total, page: filter.page, limit: filter.limit });
}
