import "server-only";
import { getRedis } from "./client";

export type RateResult = { allowed: boolean; remaining: number };

/**
 * Fixed-window counter: increments `key`, sets the window TTL on first hit,
 * allows while count <= limit. Coarser than a sliding window but cheap and
 * sufficient for per-automation+channel webhook throttling (PRD §7 gateway).
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
