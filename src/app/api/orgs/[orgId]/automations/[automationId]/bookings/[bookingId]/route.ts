import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBookingDetail, updateBookingStatus } from "@/lib/dashboard/queries";

const VALID = new Set(["confirmed", "dispatched", "completed", "cancelled", "no_show"]);

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId, bookingId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const booking = await getBookingDetail(bookingId);
  if (!booking) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ booking });
}

export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId, bookingId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID.has(body.status)) {
    return new NextResponse("Invalid status", { status: 400 });
  }
  const ok = await updateBookingStatus(bookingId, body.status as never);
  if (!ok) return new NextResponse("Update failed", { status: 500 });
  return NextResponse.json({ ok: true });
}
