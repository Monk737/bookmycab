import "server-only";
import { getRedis } from "./client";

// Sentinel stored in place of a null loader result so a cached "known-absent"
// entry is distinguishable from a cache miss. @upstash/redis .get() returns
// null for BOTH a missing key AND a stored JSON null, so without the sentinel
// a loader that returns null would re-run on every call — defeating negative
// caching entirely.
const NEGATIVE = "__cabby_null__";

/**
 * Returns the cached JSON value for `key`, or runs `loader`, caches the result
 * for `ttlSec`, and returns it.
 *
 * Negative caching: if `loader` returns `null` the sentinel `"__cabby_null__"`
 * is stored instead of the raw null (because @upstash/redis `.get()` returns
 * `null` for both a missing key and a stored JSON null, making them
 * indistinguishable without a sentinel). Subsequent calls within the TTL window
 * return `null` immediately without re-running the loader — preventing DB
 * hammering for unknown keys (e.g. unknown automation IDs in resolveAutomation).
 */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  const cached = await redis.get<T | typeof NEGATIVE>(key);
  if (cached === NEGATIVE) return null as T;          // cached known-absent
  if (cached !== null) return cached as T;            // cache hit (incl. real values)
  const value = await loader();
  await redis.set(key, value === null ? NEGATIVE : value, { ex: ttlSec });
  return value;
}

export async function del(key: string): Promise<void> {
  await getRedis().del(key);
}
