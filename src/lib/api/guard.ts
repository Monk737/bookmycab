import "server-only";
import { NextResponse } from "next/server";
import { getCurrentClaims } from "@/lib/auth/session";
import type { Claims } from "@/middleware/access";

type Role = "Owner" | "Admin" | "Viewer";
const RANK: Record<Role, number> = { Viewer: 1, Admin: 2, Owner: 3 };

export type OrgAccess =
  | { kind: "allow"; claims: Claims }
  | { kind: "unauthorized" }
  | { kind: "forbidden" };

/** Pure decision: tenant match (or staff) + role >= minRole + automation restriction. */
export function evaluateOrgAccess(
  claims: Claims | null,
  orgId: string,
  opts: { minRole: Role; automationId?: string },
): OrgAccess {
  if (!claims) return { kind: "unauthorized" };
  if (!claims.is_flowmo_staff && claims.tenant_id !== orgId) return { kind: "forbidden" };
  if (!claims.is_flowmo_staff) {
    const role = (claims.role ?? "Viewer") as Role;
    if (RANK[role] < RANK[opts.minRole]) return { kind: "forbidden" };
    // automation_restrictions (empty = all). When the user is restricted to a
    // subset, deny access to any automation outside that subset.
    if (
      claims.automation_restrictions.length > 0 &&
      opts.automationId !== undefined &&
      !claims.automation_restrictions.includes(opts.automationId)
    ) {
      return { kind: "forbidden" };
    }
  }
  return { kind: "allow", claims };
}

/** Route helper: returns claims or a NextResponse to short-circuit. */
export async function requireOrgAccess(
  orgId: string,
  opts: { minRole: Role; automationId?: string },
): Promise<{ claims: Claims } | NextResponse> {
  const claims = await getCurrentClaims();
  const decision = evaluateOrgAccess(claims, orgId, opts);
  if (decision.kind === "allow") return { claims: decision.claims };
  if (decision.kind === "unauthorized") return new NextResponse("Unauthorized", { status: 401 });
  return new NextResponse("Forbidden", { status: 403 });
}
