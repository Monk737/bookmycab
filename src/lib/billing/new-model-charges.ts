/**
 * Pure planner for new-model Stripe charges. DB/Stripe-free so it is testable.
 * Kept out of the "use server" billing-actions module (only async exports allowed there).
 */
export interface NewModelChargePlan {
  setup: { setupGbp: number };
  subscriptions: Array<{ product: "chat" | "voice"; monthlyGbp: number }>;
}

export function planNewModelCharges(args: {
  tenant: { id: string; commercial_model: string; stripe_customer_id: string | null };
  chat: { monthly_price_gbp: number; stripe_subscription_id: string | null } | null;
  voice: { monthly_price_gbp: number; stripe_subscription_id: string | null } | null;
  setupGbp: number;
}): NewModelChargePlan {
  const subs: NewModelChargePlan["subscriptions"] = [];
  if (args.chat && !args.chat.stripe_subscription_id)
    subs.push({ product: "chat", monthlyGbp: args.chat.monthly_price_gbp });
  if (args.voice && !args.voice.stripe_subscription_id)
    subs.push({ product: "voice", monthlyGbp: args.voice.monthly_price_gbp });
  return { setup: { setupGbp: args.setupGbp }, subscriptions: subs };
}
