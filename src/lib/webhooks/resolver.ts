import "server-only";
import { getOrSet } from "@/lib/redis/cache";
import { env } from "@/env";
import { loadAutomationFromDb, type ResolvedAutomation } from "./resolver-loader";

/** Shared cache key for an automation record, used by resolver + control layer. */
export function automationCacheKey(automationId: string): string {
  return `automation:${automationId}`;
}

/**
 * Resolves an automation id to its tenant/status/engine URL, cached in Redis for
 * CHANNEL_CACHE_TTL_SEC (PRD: 5 min). Negative results (null) are cached too so a
 * flood to an unknown id doesn't hammer the DB.
 */
export async function resolveAutomation(
  automationId: string,
): Promise<ResolvedAutomation | null> {
  return getOrSet<ResolvedAutomation | null>(
    automationCacheKey(automationId),
    env.CHANNEL_CACHE_TTL_SEC,
    () => loadAutomationFromDb(automationId),
  );
}
