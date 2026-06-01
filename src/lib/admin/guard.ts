import { redirect } from "next/navigation";
import { getCurrentClaims } from "@/lib/auth/session";
import type { Claims } from "@/middleware/access";

/**
 * Discriminated result of the staff-access decision. Pure and side-effect free
 * so it can be unit-tested without Next.js runtime.
 */
export type StaffAccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string };

/**
 * Pure authorization decision for the admin surface.
 *
 * - No claims (unauthenticated) → redirect to /login.
 * - Authenticated but not FlowMo staff → redirect to /dashboard.
 * - FlowMo staff → allow.
 *
 * Note: the MFA (aal2) gate is enforced upstream in middleware
 * (`evaluateAccess`), so it is intentionally not re-checked here.
 */
export function staffAccessDecision(claims: Claims | null): StaffAccessDecision {
  if (!claims) return { kind: "redirect", to: "/login" };
  if (!claims.is_flowmo_staff) return { kind: "redirect", to: "/dashboard" };
  return { kind: "allow" };
}

/**
 * Server-component / server-action guard for the admin surface.
 *
 * Defense-in-depth on top of middleware: reads the current claims, applies
 * `staffAccessDecision`, and redirects on a non-allow result. Returns the
 * claims when access is granted.
 */
export async function requireStaff(): Promise<Claims> {
  const claims = await getCurrentClaims();
  const decision = staffAccessDecision(claims);
  if (decision.kind === "redirect") redirect(decision.to);
  // `staffAccessDecision` only returns `allow` when claims is non-null.
  return claims as Claims;
}
