/**
 * BookMyCab pricing model.
 *
 * GBP is the single source of truth. All prices below are MONTHLY in GBP,
 * excluding VAT, EXCEPT the one-time setup fees and the per-call credit price.
 * EUR/USD figures shown on the page are derived at render time from live FX
 * rates (see ./fx.ts) via convert()/priceFor(); they are never stored here.
 *
 * Two products, sold standalone or together:
 *   1. Chat — WhatsApp Chat + Voice Note, priced by fleet size.
 *   2. AI Voice Booking — priced by monthly call allowance.
 *   3. Double Decker — Mix & Match: any Voice tier (full price) + any Chat tier
 *      (chat discounted). Not a fixed tier list; composed at selection time.
 */

export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCIES = ["GBP", "EUR", "USD"] as const satisfies readonly Currency[];

/** Prices are authored in this currency; everything else is derived. */
export const BASE_CURRENCY: Currency = "GBP";

export type TierKey = "ignition" | "in_motion" | "full_throttle";

/* ----------------------------------------------------------------------------
   1. CHAT — WhatsApp Chat + Voice Note
   -------------------------------------------------------------------------- */

export interface ChatTier {
  key: TierKey;
  name: string;
  fleet: string;
  /** GBP/month. Every chat tier now has a fixed price. */
  priceGbp: number;
  /** Optional note shown under the fleet line (e.g. Full Throttle's 2nd bot). */
  note?: string;
  featured?: boolean;
}

export const CHAT_TIERS: ChatTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    fleet: "Up to 50 drivers / fleet",
    priceGbp: 599,
  },
  {
    key: "in_motion",
    name: "In Motion",
    fleet: "51–100 drivers / fleet",
    priceGbp: 999,
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    fleet: "101+ drivers / fleet",
    priceGbp: 1299,
    note: "Optional 2nd WhatsApp chatbot",
  },
];

/** One-time Chat agent setup fee, GBP. */
export const CHAT_SETUP_FEE_GBP = 1000;

/* ----------------------------------------------------------------------------
   2. AI VOICE BOOKING
   -------------------------------------------------------------------------- */

export interface VoiceTier {
  key: TierKey;
  name: string;
  callsPerMonth: number;
  priceGbp: number;
  /** Human-readable agent/number configuration, e.g. "1 number · 1 agent". */
  config: string;
  featured?: boolean;
}

export const VOICE_TIERS: VoiceTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    callsPerMonth: 1500,
    priceGbp: 1299,
    config: "1 number · 1 agent",
  },
  {
    key: "in_motion",
    name: "In Motion",
    callsPerMonth: 2250,
    priceGbp: 1799,
    config: "2 numbers · 2 agents",
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    callsPerMonth: 3000,
    priceGbp: 2199,
    config: "2 numbers · 2 agents",
  },
];

/** One-time AI Voice agent setup fees, GBP. */
export const VOICE_SETUP_GBP = {
  oneAgent: 1000,
  twoAgents: 1500,
  secondAgentAddOn: 500,
} as const;

/* ----------------------------------------------------------------------------
   3. DOUBLE DECKER (Mix & Match: any Voice tier + any Chat tier)

   The bundle is composed at selection time: the chosen AI Voice tier keeps its
   full price, and the chosen Chat tier is discounted by a fixed GBP amount that
   grows with the chat tier. There is no fixed bundle-tier list.
   -------------------------------------------------------------------------- */

/** GBP knocked off the Chat tier's monthly price when bundled with Voice. */
export const BUNDLE_CHAT_DISCOUNT_GBP: Record<TierKey, number> = {
  ignition: 100,
  in_motion: 200,
  full_throttle: 300,
};

/** A chat tier's discounted monthly price inside a Double Decker bundle. */
export function bundleChatPriceGbp(chatTier: TierKey): number {
  const chat = CHAT_TIERS.find((t) => t.key === chatTier);
  const full = chat ? chat.priceGbp : 0;
  return full - BUNDLE_CHAT_DISCOUNT_GBP[chatTier];
}

/** Total monthly bundle price: full voice price + discounted chat price. */
export function bundleTotalGbp(voiceTier: TierKey, chatTier: TierKey): number {
  const voice = VOICE_TIERS.find((t) => t.key === voiceTier);
  return (voice ? voice.priceGbp : 0) + bundleChatPriceGbp(chatTier);
}

/** One-time Chat + AI Voice bundle setup fees, GBP. */
export const BUNDLE_SETUP_GBP = {
  oneVoiceAgent: 1500,
  twoVoiceAgents: 2000,
} as const;

/* ----------------------------------------------------------------------------
   EXTRA VOICE CREDIT
   -------------------------------------------------------------------------- */

/** Pay-as-you-go voice credit, GBP per call (1 credit = £0.90). */
export const EXTRA_CALL_PRICE_GBP = 0.9;

/* ----------------------------------------------------------------------------
   FORMAT / CONVERT HELPERS
   -------------------------------------------------------------------------- */

const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

/** Convert a GBP amount into `currency` using `rates` (rates[GBP] === 1). */
export function convert(
  amountGbp: number,
  currency: Currency,
  rates: Record<Currency, number>,
): number {
  const rate = rates[currency];
  return amountGbp * (typeof rate === "number" && rate > 0 ? rate : 1);
}

/**
 * Format a monetary amount for display: symbol + grouped digits.
 * Default 0 decimals (plan prices); pass { decimals: 2 } for the per-call price.
 * Non-finite/negative amounts coerce to 0 so we never render "£NaN".
 */
export function formatPrice(
  currency: Currency,
  amount: number,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 0;
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
  return `${CURRENCY_SYMBOL[currency]}${formatted}`;
}

/** Convenience: convert a GBP amount and format it in one call. */
export function priceFor(
  amountGbp: number,
  currency: Currency,
  rates: Record<Currency, number>,
  decimals = 0,
): string {
  return formatPrice(currency, convert(amountGbp, currency, rates), { decimals });
}
