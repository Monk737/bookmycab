/**
 * Billing / provisioning pricing — the figures Stripe actually charges.
 *
 * Three offerings: WhatsApp Booking Suite (chat, £499), AI Voice Booking
 * Ignition (voice, 1000 calls £1999), and Custom (configured per tenant; see
 * ./custom-plan.ts). GBP only. The fixed GBP numbers MUST equal the marketing
 * canonical numbers (src/lib/marketing/pricing.ts); tests/billing-pricing-drift
 * enforces it. `Currency` lives in the marketing module as a shared type.
 */

export type PlanType = "whatsapp_suite" | "voice_ignition" | "custom";
export type CommercialModel = "chat" | "voice" | "custom";

/** Display label for a tenant's commercial model (admin + dashboard). Tolerates
 *  the legacy `double_decker` value still present on grandfathered rows. */
export function commercialModelLabel(model: CommercialModel | string | null): string {
  switch (model) {
    case "chat":
      return "WhatsApp Booking Suite";
    case "voice":
      return "AI Voice Booking";
    case "custom":
      return "Custom plan";
    case "double_decker":
      return "Double Decker (Chat + Voice)";
    default:
      return "—";
  }
}

/** Map a plan_type to its commercial_model. Custom callers override the model
 *  from the custom-plan product flags. */
export function planTypeCommercialModel(plan: PlanType): CommercialModel {
  if (plan === "whatsapp_suite") return "chat";
  if (plan === "voice_ignition") return "voice";
  return "custom";
}

/* --- Fixed base plans (GBP) --- */
export const CHAT_SUITE_PRICE_GBP = 499;
export const CHAT_SUITE_SETUP_GBP = 999;

export const VOICE_IGNITION_SPEC = {
  callAllowance: 1000,
  priceGbp: 1999,
  setupGbp: 999,
  includedAgents: 1,
} as const;

/** Default pay-as-you-go overage when a custom plan does not set its own. */
export const DEFAULT_EXTRA_CALL_PRICE_GBP = 2;

export interface ResolvedBasePlanPricing {
  chatGbp: number | null;
  voiceGbp: number | null;
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
}

/**
 * Resolve GBP figures for a FIXED base plan. Returns null for `custom`
 * (custom pricing is resolved by ./custom-plan.ts from admin input).
 */
export function resolveBasePlanPricing(plan: PlanType): ResolvedBasePlanPricing | null {
  if (plan === "whatsapp_suite") {
    return { chatGbp: CHAT_SUITE_PRICE_GBP, voiceGbp: null, voiceAllowance: null, voiceAgents: null, setupGbp: CHAT_SUITE_SETUP_GBP };
  }
  if (plan === "voice_ignition") {
    return {
      chatGbp: null,
      voiceGbp: VOICE_IGNITION_SPEC.priceGbp,
      voiceAllowance: VOICE_IGNITION_SPEC.callAllowance,
      voiceAgents: VOICE_IGNITION_SPEC.includedAgents,
      setupGbp: VOICE_IGNITION_SPEC.setupGbp,
    };
  }
  return null;
}
