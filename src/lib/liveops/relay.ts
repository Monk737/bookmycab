import "server-only";
import { env } from "@/env";

/**
 * Relay a human staff message out to the customer's channel via the automation
 * engine. Graceful: when the engine is not configured (no N8N_BASE_URL) it logs
 * and returns false rather than throwing — mirrors sendEmail. The engine is
 * expected to expose an inbound relay webhook that forwards to the channel.
 */
export async function relayToChannel(
  args: { automationId: string; conversationId: string; customerHandle: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.N8N_BASE_URL || !env.N8N_API_KEY) {
    console.warn("relayToChannel: engine not configured — skipping outbound relay", { conversationId: args.conversationId });
    return false;
  }
  try {
    const res = await fetchImpl(`${env.N8N_BASE_URL}/webhook/staff-relay`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.N8N_API_KEY },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      console.error("relayToChannel: engine returned non-2xx", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("relayToChannel threw", err);
    return false;
  }
}
