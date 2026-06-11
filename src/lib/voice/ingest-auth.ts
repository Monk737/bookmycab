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
