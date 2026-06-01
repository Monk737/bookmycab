import "server-only";
import { getRedis } from "./client";

export type RateResult = { allowed: boolean; remaining: number };

/**
 * Fixed-window counter: increments `key`, sets the window TTL on first hit,
 * allows while count <= limit. Coarser than a sliding window but cheap and
 * sufficient for per-automation+channel webhook throttling (PRD §7 gateway).
 *
 * Known failure mode: EXPIRE only runs when count === 1. If the process dies
 * between INCR and EXPIRE the key has no TTL and lives forever (TTL returns -1),
 * permanently rate-limiting the automation until the key is manually removed.
 * This is detectable via a TTL=-1 alert; will be caught by observability in
 * Epic 11. No logic change — risk accepted for now.
 */
export async function fixedWindow(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateResult> {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
