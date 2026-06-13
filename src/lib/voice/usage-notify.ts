import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { voiceUsageLowEmail, voicePlanExhaustedEmail } from "@/lib/email/templates";

/**
 * Which usage notice (if any) a freshly-recorded call warrants. Kinds are
 * mutually exclusive so a single call never triggers two emails:
 *
 *  - `credit_blocked`  : the call was declined (no plan headroom, no credit) — urgent.
 *  - `plan_exhausted`  : the monthly pool is used up but top-up credit still covers calls.
 *  - `plan_low`        : still on plan, remaining at/under 10% of the allowance.
 *
 * The idempotency ledger (claim_usage_notification) ensures each kind is emailed
 * at most once per tenant per billing month, so calling this on every charge is
 * safe.
 */
export type UsageNoticeKind = "plan_low" | "plan_exhausted" | "credit_blocked";

export function usageNoticesFor(args: {
  creditSource: string; // 'plan' | 'topup' | 'none'
  used: number;
  allowance: number;
}): UsageNoticeKind[] {
  const allowance = Math.max(0, args.allowance);
  const used = Math.max(0, args.used);
  if (allowance <= 0) return [];

  const remaining = Math.max(0, allowance - used);
  const lowThreshold = Math.max(1, Math.ceil(allowance * 0.1));

  if (args.creditSource === "none") return ["credit_blocked"];
  if (used >= allowance) return ["plan_exhausted"];
  if (args.creditSource === "plan" && remaining <= lowThreshold) return ["plan_low"];
  return [];
}

/**
 * Best-effort usage notifications after a call is metered. Claims the notice
 * once per period, then emails the tenant's primary contact. Never throws, the
 * ingest path must still return 200 to the voice provider regardless of email.
 * Builds its own service-role client so the caller need not thread one through.
 */
export async function maybeNotifyUsage(args: {
  tenantId: string;
  used: number;
  allowance: number;
  creditBalance: number;
  creditSource: string;
  periodStart: string;
}): Promise<void> {
  const kinds = usageNoticesFor({
    creditSource: args.creditSource,
    used: args.used,
    allowance: args.allowance,
  });
  if (kinds.length === 0) return;

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: t } = await db
    .from("tenants")
    .select("name, contact_email")
    .eq("id", args.tenantId)
    .maybeSingle();
  const to = (t?.contact_email as string | null) ?? null;
  if (!to) return;
  const tenantName = (t?.name as string | null) ?? "your organisation";
  const dashboardUrl = `${env.NEXT_PUBLIC_SITE_URL}/dashboard`;

  for (const kind of kinds) {
    // Atomic once-per-period claim; skip when another call already sent it.
    const { data: claimed } = await db.rpc("claim_usage_notification", {
      p_tenant: args.tenantId,
      p_period_start: args.periodStart,
      p_kind: kind,
    });
    if (claimed !== true) continue;

    const body =
      kind === "plan_low"
        ? voiceUsageLowEmail({
            tenantName,
            remaining: Math.max(0, args.allowance - args.used),
            allowance: args.allowance,
            dashboardUrl,
          })
        : voicePlanExhaustedEmail({
            tenantName,
            creditBalance: args.creditBalance,
            blocked: kind === "credit_blocked",
            dashboardUrl,
          });
    await sendEmail({ to, subject: body.subject, html: body.html, text: body.text });
  }
}
