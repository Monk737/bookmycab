import "server-only";
import { getRedis } from "./client";

/**
 * Atomically claims `key` if unseen. Returns true the FIRST time (caller should
 * process), false if already claimed within `ttlSec` (caller should skip).
 * Uses SET NX EX so the check-and-set is atomic on the Redis side.
 */
export async function claimOnce(key: string, ttlSec: number): Promise<boolean> {
  const res = await getRedis().set(key, "1", { nx: true, ex: ttlSec });
  return res === "OK";
}

/**
 * Releases a previously-claimed `key` so a later delivery can be processed
 * again. Used when processing failed and the caller wants the source (e.g.
 * Stripe webhook retries) to redeliver rather than have the event permanently
 * deduped. Best-effort: a failed release is logged, not thrown.
 */
export async function releaseClaim(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch (err) {
    console.error("releaseClaim failed", key, err);
  }
}
