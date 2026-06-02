import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getAutomationConfig, upsertAutomationConfig } from "@/lib/dashboard/config-queries";
import { AutomationConfigSchema } from "@/lib/dashboard/config-types";
import { getCurrentClaims } from "@/lib/auth/session";

export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;

  const config = await getAutomationConfig(automationId);
  return NextResponse.json({ config });
}

export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId, automationId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  const parsed = AutomationConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid config", issues: parsed.error.issues }, { status: 400 });
  }

  const claims = await getCurrentClaims();
  const ok = await upsertAutomationConfig(
    automationId,
    claims?.tenant_id ?? orgId,
    parsed.data,
    claims?.sub ?? null,
  );

  if (!ok) {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
