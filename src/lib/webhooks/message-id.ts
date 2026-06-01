import "server-only";

export type Channel = "whatsapp" | "telegram" | "messenger" | "instagram" | "widget";

/**
 * Pulls the provider's unique message/update id from a parsed inbound body, used
 * as the idempotency key. Returns null when not found — the caller then forwards
 * without dedupe rather than dropping the event.
 */
export function extractProviderMessageId(channel: Channel, body: unknown): string | null {
  const b = body as Record<string, unknown>;
  try {
    switch (channel) {
      case "whatsapp": {
        const v = (b.entry as any)?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
        return typeof v === "string" ? v : null;
      }
      case "messenger":
      case "instagram": {
        const v = (b.entry as any)?.[0]?.messaging?.[0]?.message?.mid;
        return typeof v === "string" ? v : null;
      }
      case "telegram": {
        const v = (b as any).update_id;
        return v != null ? String(v) : null;
      }
      case "widget": {
        const v = (b as any).messageId;
        return typeof v === "string" ? v : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
