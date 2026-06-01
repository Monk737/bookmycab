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
