import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { listTickets, createTicket } from "@/lib/dashboard/support-queries";
import { getCurrentClaims } from "@/lib/auth/session";

const VALID_CATEGORIES = new Set(["technical", "billing", "build_request", "other"]);

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;

  const tickets = await listTickets(orgId);
  return NextResponse.json({ tickets });
}

export async function POST(req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const claims = await getCurrentClaims();
  const demoBlock = blockIfDemo(claims);
  if (demoBlock) return demoBlock;

  const body = (await req.json()) as {
    subject?: string;
    category?: string;
    description?: string;
    automationId?: string;
  };

  if (!body.subject || body.subject.trim() === "") {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!body.category || !VALID_CATEGORIES.has(body.category)) {
    return NextResponse.json({ error: "category must be one of: technical, billing, build_request, other" }, { status: 400 });
  }
  if (!body.description || body.description.trim() === "") {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const result = await createTicket({
    tenantId: orgId,
    automationId: body.automationId ?? null,
    createdBy: claims?.sub ?? null,
    subject: body.subject.trim(),
    category: body.category,
    description: body.description.trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
