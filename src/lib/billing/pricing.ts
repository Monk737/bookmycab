/**
 * Billing / provisioning pricing — the LEGACY A/B plan-band commercial model.
 *
 * Decoupled (B0) from the marketing pricing module
 * (`src/lib/marketing/pricing.ts`), which now advertises the new
 * Chat / AI Voice / Double Decker model. The billing stack still charges
 * tenants on the A/B fleet-band model until the B1–B4 billing migration lands;
 * these are the figures Stripe actually charges.
 *
 * The `Currency` primitive (and `CURRENCIES`) still lives in the marketing
 * module as a shared type — only the commercial constants move here.
 *
 * Source: PRD §6.1 (the original A/B model).
 */
import type { Currency } from "@/lib/marketing/pricing";

/** Minimum contract length in months (legacy fixed-term model). */
export const CONTRACT_MONTHS = 12;

/** One-time setup fee per currency (legacy A/B model), in major units. */
export const SETUP_FEE: Record<Currency, number> = {
  GBP: 1000,
  EUR: 1000,
  USD: 1200,
};

/** Monthly band prices per currency (legacy A/B model), in major units. */
export interface BandPrices {
  single: Record<Currency, number>;
  bundle: Record<Currency, number>;
}

/** Plan A (smaller fleets). */
export const BAND_A: BandPrices = {
  single: { GBP: 500, EUR: 500, USD: 600 },
  bundle: { GBP: 1000, EUR: 1000, USD: 1200 },
};

/** Plan B (larger fleets). */
export const BAND_B: BandPrices = {
  single: { GBP: 800, EUR: 800, USD: 800 },
  bundle: { GBP: 1800, EUR: 1800, USD: 2000 },
};

/* ============================================================================
   NEW MODEL (B1): Chat / AI Voice / Double Decker. GBP only, rolling-monthly.

   These are the figures Stripe actually charges. They MUST equal the marketing
   canonical GBP numbers (src/lib/marketing/pricing.ts); the drift-guard test in
   tests/billing-pricing-drift.test.ts enforces that.
   ========================================================================== */

export type NewTierKey = "ignition" | "in_motion" | "full_throttle";
export type ChatChannelMode = "single" | "bundle";
export type CommercialModel = "chat" | "voice" | "double_decker";

/** Chat monthly GBP per tier/mode; null = quoted (Full Throttle). */
export const CHAT_PRICE_GBP: Record<NewTierKey, Record<ChatChannelMode, number | null>> = {
  ignition: { single: 499, bundle: 899 },
  in_motion: { single: 999, bundle: 1799 },
  full_throttle: { single: null, bundle: null },
};

/** Voice monthly GBP per tier. */
export const VOICE_PRICE_GBP: Record<NewTierKey, number> = {
  ignition: 1199,
  in_motion: 1599,
  full_throttle: 1999,
};

/** One authored Double Decker price split: chat + voice === total. */
export interface BundleSplit {
  total: number;
  chat: number;
  voice: number;
}

/**
 * Double Decker GBP, authored so chat + voice === total (no runtime split).
 * Default allocation: voice billed at its standalone price for the bundled call
 * volume; chat absorbs the bundle discount. Confirmed with finance at spec review.
 */
export const DOUBLE_DECKER_GBP: Record<NewTierKey, Record<ChatChannelMode, BundleSplit>> = {
  ignition: {
    single: { total: 1599, chat: 400, voice: 1199 },
    bundle: { total: 1999, chat: 400, voice: 1599 },
  },
  in_motion: {
    single: { total: 2499, chat: 900, voice: 1599 },
    bundle: { total: 3199, chat: 1600, voice: 1599 },
  },
  full_throttle: {
    single: { total: 2999, chat: 1000, voice: 1999 },
    bundle: { total: 3799, chat: 1800, voice: 1999 },
  },
};

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
 * tenant has no chat product (voice-only) or the tier is quoted (Full Throttle).
 */
export function chatMonthlyPriceGbp(
  model: CommercialModel,
  tier: NewTierKey,
  mode: ChatChannelMode,
): number | null {
  if (model === "double_decker") return DOUBLE_DECKER_GBP[tier][mode].chat;
  if (model === "chat") return CHAT_PRICE_GBP[tier][mode];
  return null;
}

/**
 * The voice subscription's monthly GBP charge for a tenant, or null when the
 * tenant has no voice product (chat-only). `mode` only affects double_decker
 * (the bundle total differs by chat mode).
 */
export function voiceMonthlyPriceGbp(
  model: CommercialModel,
  tier: NewTierKey,
  mode: ChatChannelMode,
): number | null {
  if (model === "double_decker") return DOUBLE_DECKER_GBP[tier][mode].voice;
  if (model === "voice") return VOICE_PRICE_GBP[tier];
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
  chatMode: ChatChannelMode | null;
  voiceTier: NewTierKey | null;
}

export interface ResolvedNewModelPricing {
  chatGbp: number | null;     // null = no chat product OR quoted (full_throttle)
  voiceGbp: number | null;    // null = no voice product
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
}

/**
 * Resolve all GBP figures + voice operational shape for a provisioning
 * selection. chatGbp is null for a voice-only tenant or a quoted Full Throttle
 * chat tier (the caller supplies a manual override in that case).
 */
export function resolveNewModelPricing(sel: NewModelSelection): ResolvedNewModelPricing {
  const hasChat = sel.model === "chat" || sel.model === "double_decker";
  const hasVoice = sel.model === "voice" || sel.model === "double_decker";

  const chatGbp =
    hasChat && sel.chatTier && sel.chatMode
      ? chatMonthlyPriceGbp(sel.model, sel.chatTier, sel.chatMode)
      : null;

  const voiceGbp =
    hasVoice && sel.voiceTier
      ? voiceMonthlyPriceGbp(sel.model, sel.voiceTier, sel.chatMode ?? "single")
      : null;

  const voiceAllowance = hasVoice && sel.voiceTier ? VOICE_PLAN_SPEC[sel.voiceTier].callAllowance : null;
  const voiceAgents = hasVoice && sel.voiceTier ? VOICE_PLAN_SPEC[sel.voiceTier].includedAgents : null;

  const setupGbp = setupFeeGbp(sel.model, (voiceAgents ?? 0) as 0 | 1 | 2);

  return { chatGbp, voiceGbp, voiceAllowance, voiceAgents, setupGbp };
}
