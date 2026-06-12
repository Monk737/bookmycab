/**
 * Pure provisioning model — schema, types, and the DB-free row builder.
 *
 * Kept OUT of `actions.ts` because that file is `"use server"`, and a Server
 * Actions module may only export async functions. These synchronous exports
 * (zod schema, types, pure builder) live here and are imported by both the
 * server action and the client form.
 */
import { z } from "zod";
import {
  resolveNewModelPricing,
  type CommercialModel,
  type NewTierKey,
} from "@/lib/billing/pricing";
import { applyDiscount } from "@/lib/admin/coupons";
import { COUNTRY_CODES } from "@/lib/billing/country";

/** Form-state shape for the provisioning form (mirrors the auth AuthState). */
export type TenantFormState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
};

// Empty-string optional helper: turns "" into undefined so optional fields are
// not tripped by blank inputs.
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

const COMMERCIAL_MODELS = ["chat", "voice", "double_decker"] as const;
const TIERS = ["ignition", "in_motion", "full_throttle"] as const;
const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1, "Org name is required."),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required.")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase letters, numbers and single hyphens.",
      ),
    country: z.enum(COUNTRY_CODES, { message: "Select a valid country." }),
    contact_email: z.string().trim().email("Enter a valid contact email."),
    dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
    dispatch_company_id: optionalText,
    commercial_model: z.enum(COMMERCIAL_MODELS),
    chat_tier: z.enum(TIERS).optional(),
    voice_tier: z.enum(TIERS).optional(),
    coupon_code: optionalText,
  })
  .superRefine((d, ctx) => {
    const hasChat = d.commercial_model === "chat" || d.commercial_model === "double_decker";
    const hasVoice = d.commercial_model === "voice" || d.commercial_model === "double_decker";
    if (hasChat && !d.chat_tier)
      ctx.addIssue({ code: "custom", path: ["chat_tier"], message: "Pick a chat tier." });
    if (hasVoice && !d.voice_tier)
      ctx.addIssue({ code: "custom", path: ["voice_tier"], message: "Pick a voice tier." });
  });

export type CreateTenantData = z.infer<typeof createTenantSchema>;

export interface ProvisioningRows {
  tenant: {
    name: string;
    slug: string;
    country: string;
    currency: "GBP";
    commercial_model: CommercialModel;
    /** Combined monthly GBP (chat + voice), the source of truth for MRR. */
    monthly_price: number;
    dispatch_adapter: string;
    dispatch_company_id: string | null;
    contact_email: string;
    coupon_code: string | null;
    discount_percent: number;
    billing_bypass: boolean;
    status: "onboarding" | "active";
  };
  chat: { plan_tier: NewTierKey; monthly_price_gbp: number } | null;
  voice: {
    plan_tier: NewTierKey;
    monthly_price_gbp: number;
    monthly_call_allowance: number;
    included_agents: number;
  } | null;
  setupGbp: number;
}

/**
 * Pure provisioning-row builder: resolves new-model pricing, applies the coupon
 * discount (or forces 0 when bypassed), and shapes the tenant + chat/voice
 * subscription rows. DB-free so it is unit-testable.
 */
export function buildProvisioningRows(args: {
  data: CreateTenantData;
  discountPercent: number;
  bypass: boolean;
}): ProvisioningRows {
  const { data, discountPercent, bypass } = args;
  const resolved = resolveNewModelPricing({
    model: data.commercial_model,
    chatTier: data.chat_tier ?? null,
    voiceTier: data.voice_tier ?? null,
  });

  // Every chat tier now has a fixed list price (Full Throttle included).
  const chatBase = resolved.chatGbp;

  const priced = (base: number | null): number | null =>
    base === null ? null : bypass ? 0 : applyDiscount(base, discountPercent);

  const hasChat = data.commercial_model === "chat" || data.commercial_model === "double_decker";
  const hasVoice = data.commercial_model === "voice" || data.commercial_model === "double_decker";

  // Final, discount-applied product prices. The tenant's monthly_price is the
  // sum of these — the single source of truth for MRR/ARR reporting.
  const chatGbp = hasChat && data.chat_tier ? priced(chatBase) ?? 0 : 0;
  const voiceGbp = hasVoice && data.voice_tier ? priced(resolved.voiceGbp) ?? 0 : 0;

  return {
    tenant: {
      name: data.name,
      slug: data.slug,
      country: data.country,
      currency: "GBP",
      commercial_model: data.commercial_model,
      monthly_price: chatGbp + voiceGbp,
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email,
      coupon_code: data.coupon_code ?? null,
      discount_percent: discountPercent,
      billing_bypass: bypass,
      status: bypass ? "active" : "onboarding",
    },
    chat:
      hasChat && data.chat_tier
        ? {
            plan_tier: data.chat_tier,
            monthly_price_gbp: chatGbp,
          }
        : null,
    voice:
      hasVoice && data.voice_tier
        ? {
            plan_tier: data.voice_tier,
            monthly_price_gbp: voiceGbp,
            monthly_call_allowance: resolved.voiceAllowance ?? 0,
            included_agents: resolved.voiceAgents ?? 0,
          }
        : null,
    setupGbp: bypass ? 0 : applyDiscount(resolved.setupGbp, discountPercent),
  };
}
