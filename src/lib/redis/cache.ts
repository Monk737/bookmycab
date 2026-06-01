import "server-only";
import { getRedis } from "./client";

/**
 * Returns the cached JSON value for `key`, or runs `loader`, caches the result
 * for `ttlSec`, and returns it. `null` results from the loader are cached too
 * (negative caching) to avoid hammering the DB for unknown keys.
 */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  const cached = await redis.get<T>(key);
  if (cached !== null && cached !== undefined) return cached;
  const value = await loader();
  // @upstash/redis JSON-serialises automatically; store with TTL.
  await redis.set(key, value, { ex: ttlSec });
  return value;
}

export async function del(key: string): Promise<void> {
  await getRedis().del(key);
}
