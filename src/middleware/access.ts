export type Claims = {
  sub: string;
  tenant_id: string | null;
  role: "Owner" | "Admin" | "Viewer" | null;
  is_flowmo_staff: boolean;
  aal: "aal1" | "aal2" | null;
  automation_restrictions: string[];
};

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "forbidden" };

// Paths reachable without a session.
const PUBLIC_PREFIXES = ["/login", "/auth", "/webhooks", "/_next", "/favicon", "/demo"];
export const PUBLIC_PAGES = new Set([
  "/", "/pricing", "/how-it-works", "/channels", "/custom-solutions",
  "/case-studies", "/about", "/contact", "/privacy", "/terms", "/dpa", "/cookies",
]);

// Auth-flow paths that must always be reachable (even when authenticated at aal1)
// to prevent redirect loops.
export const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password", "/accept-invite", "/mfa"];

// Roles that require MFA (aal2) to access protected routes.
const MFA_REQUIRED_ROLES = new Set<NonNullable<Claims["role"]>>(["Owner", "Admin"]);

/** Maps a raw JWT payload into the typed Claims shape. */
export function parseClaims(raw: Record<string, unknown>): Claims {
  return {
    sub: String(raw.sub),
    tenant_id: (raw.tenant_id as string) ?? null,
    role: (raw.role as Claims["role"]) ?? null,
    is_flowmo_staff: Boolean(raw.is_flowmo_staff),
    aal: (raw.aal as Claims["aal"]) ?? null,
    automation_restrictions: Array.isArray(raw.automation_restrictions)
      ? (raw.automation_restrictions as string[])
      : [],
  };
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Pure route authorization. `claims` is null for unauthenticated requests. */
export function evaluateAccess(pathname: string, claims: Claims | null): AccessDecision {
  if (isPublic(pathname)) return { kind: "allow" };

  if (!claims) return { kind: "redirect", to: "/login" };

  // Auth-flow routes are always reachable for authenticated users to avoid redirect loops.
  if (isAuthRoute(pathname)) return { kind: "allow" };

  // MFA gate: Owner and Admin must have aal2 to access any protected route.
  if (claims.role !== null && MFA_REQUIRED_ROLES.has(claims.role) && claims.aal !== "aal2") {
    return { kind: "redirect", to: "/mfa" };
  }

  // Admin surface: FlowMo staff only.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return claims.is_flowmo_staff ? { kind: "allow" } : { kind: "redirect", to: "/dashboard" };
  }

  // Tenant API: the :orgId segment must match the caller's tenant.
  const orgMatch = pathname.match(/^\/api\/orgs\/([^/]+)/);
  if (orgMatch) {
    const orgId = orgMatch[1];
    if (claims.is_flowmo_staff) return { kind: "allow" };
    return orgId === claims.tenant_id ? { kind: "allow" } : { kind: "forbidden" };
  }

  // Everything else under /dashboard etc. requires a session (already true here).
  return { kind: "allow" };
}
