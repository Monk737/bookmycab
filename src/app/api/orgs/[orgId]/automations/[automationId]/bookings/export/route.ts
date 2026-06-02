import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBookingsPage } from "@/lib/dashboard/queries";
import { parseBookingFilter, bookingToCsvRow, BOOKING_CSV_HEADERS } from "@/lib/dashboard/bookings-filter";
import { toCsv } from "@/lib/dashboard/csv";

export async function GET(req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const filter = parseBookingFilter(new URL(req.url).searchParams);
  const { rows } = await getBookingsPage({ automationId, filter: { ...filter, page: 1, limit: 100 } });
  const csv = toCsv([...BOOKING_CSV_HEADERS], rows.map(bookingToCsvRow));
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookings-${automationId}.csv"`,
    },
  });
}
