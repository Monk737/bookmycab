export type Claims = {
  sub: string;
  tenant_id: string | null;
  role: "Owner" | "Admin" | "Viewer" | null;
  is_flowmo_staff: boolean;
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

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pure route authorization. `claims` is null for unauthenticated requests. */
export function evaluateAccess(pathname: string, claims: Claims | null): AccessDecision {
  if (isPublic(pathname)) return { kind: "allow" };

  if (!claims) return { kind: "redirect", to: "/login" };

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
