import "server-only";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

let client: Redis | null = null;

/** Lazily constructs the Upstash REST Redis client. Throws if unconfigured. */
export function getRedis(): Redis {
  if (client) return client;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN).");
  }
  client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return client;
}

/** True when Redis env is present (used to skip integration tests cleanly). */
export function isRedisConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
