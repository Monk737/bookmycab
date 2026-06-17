/**
 * Pure planner for the activation invoice (setup + first period). DB/Stripe-free.
 * Recurring → one subscription per product (first invoice folds in the setup
 * fee via add_invoice_items at the call site). One-time → no subscription; the
 * pack price + setup become one-off invoice lines.
 */
type SubRow = { monthly_price_gbp: number; stripe_subscription_id: string | null } | null;

export interface ActivationPlan {
  mode: "recurring" | "one_time";
  setupGbp: number;
  subscriptions: Array<{ product: "chat" | "voice"; monthlyGbp: number }>;
  oneTimeLines: Array<{ label: string; amountGbp: number }>;
}

export function planActivationCharges(args: {
  billingMode: "recurring" | "one_time";
  setupGbp: number;
  chat: SubRow;
  voice: SubRow;
}): ActivationPlan {
  if (args.billingMode === "one_time") {
    const oneTimeLines: ActivationPlan["oneTimeLines"] = [];
    if (args.chat) oneTimeLines.push({ label: "BookMyCab — WhatsApp Suite", amountGbp: args.chat.monthly_price_gbp });
    if (args.voice) oneTimeLines.push({ label: "BookMyCab — AI Voice pack", amountGbp: args.voice.monthly_price_gbp });
    return { mode: "one_time", setupGbp: args.setupGbp, subscriptions: [], oneTimeLines };
  }
  const subscriptions: ActivationPlan["subscriptions"] = [];
  if (args.chat && !args.chat.stripe_subscription_id)
    subscriptions.push({ product: "chat", monthlyGbp: args.chat.monthly_price_gbp });
  if (args.voice && !args.voice.stripe_subscription_id)
    subscriptions.push({ product: "voice", monthlyGbp: args.voice.monthly_price_gbp });
  return { mode: "recurring", setupGbp: args.setupGbp, subscriptions, oneTimeLines: [] };
}
