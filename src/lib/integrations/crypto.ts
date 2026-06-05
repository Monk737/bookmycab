import { createHash, createHmac, randomBytes } from "node:crypto";

export interface GeneratedKey { raw: string; prefix: string; hash: string }

/** Generate an API key: `cab_<prefix8><secret>`. The raw value is returned once. */
export function generateApiKey(): GeneratedKey {
  const body = randomBytes(24).toString("hex"); // 48 hex chars
  const raw = `cab_${body}`;
  const prefix = raw.slice(0, 12); // "cab_" + first 8 hex
  return { raw, prefix, hash: hashKey(raw) };
}

/** Deterministic SHA-256 hex of a raw key (what we store + look up by). */
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** HMAC-SHA256 hex signature of a webhook payload with the hook's secret. */
export function signWebhook(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export interface WebhookLike { id: string; url: string; events: string[]; enabled: boolean }

/** Pure: enabled webhooks subscribed to `event` (or the `*` wildcard). */
export function matchWebhooks<T extends WebhookLike>(webhooks: T[], event: string): T[] {
  return webhooks.filter((h) => h.enabled && (h.events.includes(event) || h.events.includes("*")));
}
