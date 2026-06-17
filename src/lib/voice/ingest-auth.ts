import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check that an `Authorization: Bearer <token>` header carries the
 * expected secret. False on a null/malformed header or an empty secret.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  if (!secret) return false;
  if (!header || !header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  if (token.length === 0) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false; // timingSafeEqual throws on length mismatch
  return timingSafeEqual(a, b);
}

/**
 * Read an optional `tenant_id` from a cron request's JSON body. Returns the
 * trimmed id, or null when the body is empty / not JSON / has no tenant_id —
 * letting a route fall back to its all-tenant sweep. Never throws.
 */
export async function optionalTenantId(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { tenant_id?: unknown } | null;
    const id = body?.tenant_id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}
