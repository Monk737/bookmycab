/**
 * Billing / provisioning pricing — the figures Stripe actually charges.
 *
 * Two products (Chat = WhatsApp Chat + Voice Note, Voice = AI Voice Booking),
 * sold standalone or together as a Double Decker (Mix & Match) bundle. GBP only,
 * rolling-monthly. These GBP numbers MUST equal the marketing canonical numbers
 * (src/lib/marketing/pricing.ts); tests/billing-pricing-drift.test.ts enforces it.
 *
 * The `Currency` primitive lives in the marketing module as a shared type.
 */

export type NewTierKey = "ignition" | "in_motion" | "full_throttle";
export type CommercialModel = "chat" | "voice" | "double_decker";

/** Display label for a tenant's commercial model (admin + dashboard). */
export function commercialModelLabel(model: CommercialModel | string | null): string {
  switch (model) {
    case "chat":
      return "WhatsApp Chat + Voice Note";
    case "voice":
      return "AI Voice Booking";
    case "double_decker":
      return "Double Decker (Chat + Voice)";
    default:
      return "—";
  }
}

/** Display label for a plan tier. */
export function tierLabel(tier: NewTierKey | string | null): string {
  switch (tier) {
    case "ignition":
      return "Ignition";
    case "in_motion":
      return "In Motion";
    case "full_throttle":
      return "Full Throttle";
    default:
      return "—";
  }
}

/** Chat monthly GBP per tier (single price, no channel modes). */
export const CHAT_PRICE_GBP: Record<NewTierKey, number> = {
  ignition: 599,
  in_motion: 999,
  full_throttle: 1299,
};

/** Voice monthly GBP per tier. */
export const VOICE_PRICE_GBP: Record<NewTierKey, number> = {
  ignition: 1299,
  in_motion: 1799,
  full_throttle: 2199,
};

/**
 * Double Decker (Mix & Match): the chosen Voice tier keeps its full price and
 * the chosen Chat tier is discounted by this GBP amount. Bundle total =
 * VOICE_PRICE_GBP[voiceTier] + (CHAT_PRICE_GBP[chatTier] − discount).
 */
export const BUNDLE_CHAT_DISCOUNT_GBP: Record<NewTierKey, number> = {
  ignition: 100,
  in_motion: 200,
  full_throttle: 300,
};

/** A chat tier's discounted monthly GBP inside a Double Decker bundle. */
export function bundleChatPriceGbp(chatTier: NewTierKey): number {
  return CHAT_PRICE_GBP[chatTier] - BUNDLE_CHAT_DISCOUNT_GBP[chatTier];
}

/** One-time setup fees (GBP). */
export const NEW_CHAT_SETUP_GBP = 1000;
export const NEW_VOICE_SETUP_GBP = {
  oneAgent: 1000,
  twoAgents: 1500,
  secondAgentAddOn: 500,
} as const;
export const NEW_BUNDLE_SETUP_GBP = {
  oneVoiceAgent: 1500,
  twoVoiceAgents: 2000,
} as const;

/**
 * The chat subscription's monthly GBP charge for a tenant, or null when the
 * tenant has no chat product (voice-only). Bundled chat is discounted.
 */
export function chatMonthlyPriceGbp(
  model: CommercialModel,
  tier: NewTierKey,
): number | null {
  if (model === "double_decker") return bundleChatPriceGbp(tier);
  if (model === "chat") return CHAT_PRICE_GBP[tier];
  return null;
}

/**
 * The voice subscription's monthly GBP charge for a tenant, or null when the
 * tenant has no voice product (chat-only). Voice is never bundle-discounted.
 */
export function voiceMonthlyPriceGbp(
  model: CommercialModel,
  tier: NewTierKey,
): number | null {
  if (model === "double_decker" || model === "voice") return VOICE_PRICE_GBP[tier];
  return null;
}

/* ----------------------------------------------------------------------------
   B2: Provisioning helpers — operational voice plan shape + resolved pricing.
   -------------------------------------------------------------------------- */

/** Operational shape of a voice plan tier (drives voice_subscriptions). */
export interface VoicePlanSpec {
  callAllowance: number;
  includedAgents: number;
}

export const VOICE_PLAN_SPEC: Record<NewTierKey, VoicePlanSpec> = {
  ignition: { callAllowance: 1500, includedAgents: 1 },
  in_motion: { callAllowance: 2250, includedAgents: 2 },
  full_throttle: { callAllowance: 3000, includedAgents: 2 },
};

/** One-time setup fee (GBP) for a commercial model + voice agent count. */
export function setupFeeGbp(model: CommercialModel, voiceAgents: 0 | 1 | 2): number {
  if (model === "chat") return NEW_CHAT_SETUP_GBP;
  if (model === "voice") {
    return voiceAgents >= 2 ? NEW_VOICE_SETUP_GBP.twoAgents : NEW_VOICE_SETUP_GBP.oneAgent;
  }
  return voiceAgents >= 2 ? NEW_BUNDLE_SETUP_GBP.twoVoiceAgents : NEW_BUNDLE_SETUP_GBP.oneVoiceAgent;
}

export interface NewModelSelection {
  model: CommercialModel;
  chatTier: NewTierKey | null;
  voiceTier: NewTierKey | null;
}

export interface ResolvedNewModelPricing {
  chatGbp: number | null;     // null = no chat product (voice-only)
  voiceGbp: number | null;    // null = no voice product (chat-only)
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
}

/**
 * Resolve all GBP figures + voice operational shape for a provisioning
 * selection. chatGbp is null for a voice-only tenant; voiceGbp is null for a
 * chat-only tenant. Bundled chat is discounted automatically.
 */
export function resolveNewModelPricing(sel: NewModelSelection): ResolvedNewModelPricing {
  const hasChat = sel.model === "chat" || sel.model === "double_decker";
  const hasVoice = sel.model === "voice" || sel.model === "double_decker";

  const chatGbp =
    hasChat && sel.chatTier ? chatMonthlyPriceGbp(sel.model, sel.chatTier) : null;

  const voiceGbp =
    hasVoice && sel.voiceTier ? voiceMonthlyPriceGbp(sel.model, sel.voiceTier) : null;

  const voiceAllowance = hasVoice && sel.voiceTier ? VOICE_PLAN_SPEC[sel.voiceTier].callAllowance : null;
  const voiceAgents = hasVoice && sel.voiceTier ? VOICE_PLAN_SPEC[sel.voiceTier].includedAgents : null;

  const setupGbp = setupFeeGbp(sel.model, (voiceAgents ?? 0) as 0 | 1 | 2);

  return { chatGbp, voiceGbp, voiceAllowance, voiceAgents, setupGbp };
}
