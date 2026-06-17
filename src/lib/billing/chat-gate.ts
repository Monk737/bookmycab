/**
 * Chat subscription gate. The WhatsApp Chatbot is subscription-based and runs on
 * an n8n workflow reached through the webhook gateway. When the tenant's chat
 * subscription lapses (status no longer 'active') the gateway stops forwarding
 * inbound messages, and resumes automatically once Stripe flips the status back
 * to 'active' on renewal — mirroring the AI Voice pre-call authorize gate.
 *
 * `past_due` (failed renewal during Stripe dunning) maps to 'active' upstream
 * (event-map STRIPE_STATUS_MAP), so service continues while the card is retried;
 * only a 'paused' / 'cancelled' subscription blocks here.
 *
 * A null status means the tenant has no chat_subscriptions row (legacy /
 * grandfathered / demo) — those are not gated, preserving existing behaviour.
 */
export function chatServiceAllowed(chatSubStatus: string | null | undefined): boolean {
  // `== null` covers both null and undefined (no chat_subscriptions row, or an
  // older cached resolver record without the field) — those are not gated.
  return chatSubStatus == null || chatSubStatus === "active";
}
