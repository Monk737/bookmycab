import { z } from "zod";

/**
 * Pre-call authorization for AI Voice calls (the "credit gate").
 *
 * Called by the per-tenant n8n workflow BEFORE engaging tools (and, when the
 * tenant's Vapi phone number is configured with an assistant-request server
 * URL, before the assistant even answers). Pure decision logic lives here so
 * it is unit-testable; the route supplies live numbers.
 */

export const authorizeSchema = z.object({
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid().optional(),
});

export function parseAuthorizeBody(input: unknown) {
  return authorizeSchema.safeParse(input);
}

export type AuthorizeReason = "ok" | "no_plan" | "exhausted";

export interface AuthorizeDecision {
  allowed: boolean;
  reason: AuthorizeReason;
  pool: { used: number; allowance: number; remaining: number };
  credit_balance: number;
}

/**
 * A call is allowed while the tenant has an active voice plan AND either the
 * monthly pool has headroom or prepaid top-up credit remains. This mirrors
 * record_voice_call's charging order (pool first, then credit), so the gate
 * and the meter can never disagree about whether call N is payable.
 */
export function decideCallAuthorization(args: {
  planStatus: string | null;
  allowance: number;
  used: number;
  creditBalance: number;
}): AuthorizeDecision {
  const allowance = Math.max(0, args.allowance);
  const used = Math.max(0, args.used);
  const credit = Math.max(0, args.creditBalance);
  const pool = { used, allowance, remaining: Math.max(0, allowance - used) };

  if (args.planStatus !== "active") {
    return { allowed: false, reason: "no_plan", pool, credit_balance: credit };
  }
  if (pool.remaining > 0 || credit > 0) {
    return { allowed: true, reason: "ok", pool, credit_balance: credit };
  }
  return { allowed: false, reason: "exhausted", pool, credit_balance: credit };
}
