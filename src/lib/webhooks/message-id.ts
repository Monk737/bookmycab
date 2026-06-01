import "server-only";

export type Channel = "whatsapp" | "telegram" | "messenger" | "instagram" | "widget";

/**
 * Safely walks a path of object keys / array indices over an `unknown` value,
 * returning the value at the path or undefined if any hop is missing or the
 * wrong shape. Avoids `any` while traversing untyped provider payloads.
 */
function dig(value: unknown, ...path: (string | number)[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (current == null) return undefined;
    if (typeof key === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }
  }
  return current;
}

/**
 * Pulls the provider's unique message/update id from a parsed inbound body, used
 * as the idempotency key. Returns null when not found — the caller then forwards
 * without dedupe rather than dropping the event.
 */
export function extractProviderMessageId(channel: Channel, body: unknown): string | null {
  switch (channel) {
    case "whatsapp": {
      const v = dig(body, "entry", 0, "changes", 0, "value", "messages", 0, "id");
      return typeof v === "string" ? v : null;
    }
    case "messenger":
    case "instagram": {
      const v = dig(body, "entry", 0, "messaging", 0, "message", "mid");
      return typeof v === "string" ? v : null;
    }
    case "telegram": {
      const v = dig(body, "update_id");
      return v != null ? String(v) : null;
    }
    case "widget": {
      const v = dig(body, "messageId");
      return typeof v === "string" ? v : null;
    }
    default:
      return null;
  }
}
