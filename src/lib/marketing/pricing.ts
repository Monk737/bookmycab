/**
 * BookMyCab pricing model.
 *
 * GBP is the single source of truth. All prices below are MONTHLY in GBP,
 * excluding VAT, EXCEPT the one-time setup fees and the per-call credit price.
 * EUR/USD figures shown on the page are derived at render time from live FX
 * rates (see ./fx.ts) via convert()/priceFor(); they are never stored here.
 *
 * Three products:
 *   1. Chat (multi-channel chatbot)
 *   2. AI Voice Booking (priced by monthly call allowance)
 *   3. Double Decker (Chat + AI Voice bundle)
 */

export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCIES = ["GBP", "EUR", "USD"] as const satisfies readonly Currency[];

/** Prices are authored in this currency; everything else is derived. */
export const BASE_CURRENCY: Currency = "GBP";

export type TierKey = "ignition" | "in_motion" | "full_throttle";

/* ----------------------------------------------------------------------------
   1. CHAT
   -------------------------------------------------------------------------- */

export interface ChatTier {
  key: TierKey;
  name: string;
  fleet: string;
  /** GBP/month for a single channel, or null when contact-only. */
  singleGbp: number | null;
  /** GBP/month for the channel bundle, or null when contact-only. */
  bundleGbp: number | null;
  /** Maximum channels included in the bundle rate, or null when contact-only. */
  bundleMaxChannels: number | null;
  contactOnly: boolean;
  featured?: boolean;
}

export const CHAT_TIERS: ChatTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    fleet: "Up to 50 drivers / fleet",
    singleGbp: 499,
    bundleGbp: 899,
    bundleMaxChannels: 2,
    contactOnly: false,
  },
  {
    key: "in_motion",
    name: "In Motion",
    fleet: "51–100 drivers / fleet",
    singleGbp: 999,
    bundleGbp: 1799,
    bundleMaxChannels: 2,
    contactOnly: false,
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    fleet: "101+ drivers, or 4+ channels / custom",
    singleGbp: null,
    bundleGbp: null,
    bundleMaxChannels: null,
    contactOnly: true,
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
    priceGbp: 1199,
    config: "1 number · 1 agent",
  },
  {
    key: "in_motion",
    name: "In Motion",
    callsPerMonth: 2250,
    priceGbp: 1599,
    config: "2 numbers · 2 agents",
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    callsPerMonth: 3000,
    priceGbp: 1999,
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
   3. DOUBLE DECKER (Chat + AI Voice)
   -------------------------------------------------------------------------- */

export interface BundleRow {
  label: string;
  priceGbp: number;
}

export interface BundleTier {
  key: TierKey;
  name: string;
  /** Single chat channel + voice calls. */
  single: BundleRow;
  /** Bundle chat (2 channels) + voice calls. */
  bundle: BundleRow;
  featured?: boolean;
}

export const BUNDLE_TIERS: BundleTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    single: {
      label: "Single chat channel (up to 50 fleet) + 1,500 calls/mo",
      priceGbp: 1599,
    },
    bundle: {
      label: "Bundle chat (2 channels) + 2,250 calls/mo",
      priceGbp: 1999,
    },
  },
  {
    key: "in_motion",
    name: "In Motion",
    single: {
      label: "Single chat channel (51–100 fleet) + 2,250 calls/mo",
      priceGbp: 2499,
    },
    bundle: {
      label: "Bundle chat (2 channels) + 2,250 calls/mo",
      priceGbp: 3199,
    },
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    single: {
      label: "Single chat channel (101+ fleet) + 3,000 calls/mo",
      priceGbp: 2999,
    },
    bundle: {
      label: "Bundle chat (2 channels) + 3,000 calls/mo",
      priceGbp: 3799,
    },
  },
];

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
