/**
 * Pure provisioning model — schema, types, and the DB-free row builder.
 * Exports are synchronous so they can be shared by the "use server" action and
 * the client form (a Server Actions module may only export async functions).
 */
import { z } from "zod";
import {
  resolveBasePlanPricing,
  planTypeCommercialModel,
  type CommercialModel,
  type PlanType,
} from "@/lib/billing/pricing";
import { resolveCustomPlan, packExpiry, type CustomPlanInput } from "@/lib/billing/custom-plan";
import { applyDiscount } from "@/lib/admin/coupons";
import { COUNTRY_CODES } from "@/lib/billing/country";

export type TenantFormState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
};

const optionalText = z.string().trim().transform((v) => v || undefined).optional();
const PLAN_TYPES = ["whatsapp_suite", "voice_ignition", "custom"] as const;
const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1, "Org name is required."),
    slug: z
      .string().trim().min(1, "Slug is required.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and single hyphens."),
    country: z.enum(COUNTRY_CODES, { message: "Select a valid country." }),
    contact_email: z.string().trim().email("Enter a valid contact email."),
    dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
    dispatch_company_id: optionalText,
    plan_type: z.enum(PLAN_TYPES),
    coupon_code: optionalText,
    // Custom-plan fields (only required when plan_type === "custom").
    custom_plan_name: optionalText,
    custom_billing_mode: z.enum(["recurring", "one_time"]).optional(),
    custom_includes_chat: checkbox.optional(),
    custom_includes_voice: checkbox.optional(),
    custom_call_allowance: optionalText,
    custom_included_agents: optionalText,
    custom_price_per_call_gbp: optionalText,
    custom_plan_price_gbp: optionalText,
    custom_chat_monthly_gbp: optionalText,
    custom_setup_fee_gbp: optionalText,
    custom_validity_days: optionalText,
    custom_extra_credit_price_gbp: optionalText,
  })
  .superRefine((d, ctx) => {
    if (d.plan_type !== "custom") return;
    const ok = (v: unknown) => v !== undefined && v !== "";
    if (!ok(d.custom_plan_name)) ctx.addIssue({ code: "custom", path: ["custom_plan_name"], message: "Plan name is required." });
    if (!d.custom_billing_mode) ctx.addIssue({ code: "custom", path: ["custom_billing_mode"], message: "Pick a billing mode." });
    if (!ok(d.custom_plan_price_gbp)) ctx.addIssue({ code: "custom", path: ["custom_plan_price_gbp"], message: "Set the plan price." });
    if (!ok(d.custom_validity_days)) ctx.addIssue({ code: "custom", path: ["custom_validity_days"], message: "Set the pack validity." });
    if (!d.custom_includes_chat && !d.custom_includes_voice)
      ctx.addIssue({ code: "custom", path: ["custom_includes_voice"], message: "Include the WhatsApp Suite, AI Voice, or both." });
    if (d.custom_includes_chat && !ok(d.custom_chat_monthly_gbp))
      ctx.addIssue({ code: "custom", path: ["custom_chat_monthly_gbp"], message: "Set the WhatsApp Suite monthly price." });
  });

export type CreateTenantData = z.infer<typeof createTenantSchema>;

export interface CustomPlanRow {
  plan_name: string;
  billing_mode: "recurring" | "one_time";
  includes_chat: boolean;
  includes_voice: boolean;
  monthly_call_allowance: number;
  included_agents: number;
  price_per_call_gbp: number | null;
  plan_price_gbp: number;
  chat_monthly_gbp: number | null;
  setup_fee_gbp: number;
  validity_days: number;
  extra_credit_price_gbp: number;
  starts_at: string;
  expires_at: string;
}

export interface ProvisioningRows {
  tenant: {
    name: string;
    slug: string;
    country: string;
    currency: "GBP";
    commercial_model: CommercialModel;
    plan_type: PlanType;
    monthly_price: number;
    dispatch_adapter: string;
    dispatch_company_id: string | null;
    contact_email: string;
    coupon_code: string | null;
    discount_percent: number;
    billing_bypass: boolean;
    status: "onboarding" | "active";
  };
  chat: { plan_tier: "ignition" | "custom"; monthly_price_gbp: number } | null;
  voice: {
    plan_tier: "ignition" | "custom";
    monthly_price_gbp: number;
    monthly_call_allowance: number;
    included_agents: number;
  } | null;
  custom: CustomPlanRow | null;
  setupGbp: number;
}

/** Build the custom-plan input from the validated form fields. */
function toCustomInput(d: CreateTenantData): CustomPlanInput {
  return {
    planName: d.custom_plan_name ?? "",
    billingMode: d.custom_billing_mode ?? "recurring",
    includesChat: Boolean(d.custom_includes_chat),
    includesVoice: Boolean(d.custom_includes_voice),
    callAllowance: Number(d.custom_call_allowance ?? 0),
    includedAgents: Number(d.custom_included_agents ?? 0),
    pricePerCallGbp: d.custom_price_per_call_gbp != null ? Number(d.custom_price_per_call_gbp) : null,
    planPriceGbp: Number(d.custom_plan_price_gbp ?? 0),
    chatMonthlyGbp: d.custom_chat_monthly_gbp != null ? Number(d.custom_chat_monthly_gbp) : null,
    setupFeeGbp: Number(d.custom_setup_fee_gbp ?? 0),
    validityDays: Number(d.custom_validity_days ?? 30),
    extraCreditPriceGbp: Number(d.custom_extra_credit_price_gbp ?? 0.9),
  };
}

/**
 * Pure provisioning-row builder. Resolves base or custom pricing, applies the
 * coupon discount (or forces 0 on bypass), and shapes the tenant + chat/voice +
 * custom rows. DB-free so it is unit-testable.
 */
export function buildProvisioningRows(args: {
  data: CreateTenantData;
  discountPercent: number;
  bypass: boolean;
}): ProvisioningRows {
  const { data, discountPercent, bypass } = args;
  const priced = (base: number | null): number | null =>
    base === null ? null : bypass ? 0 : applyDiscount(base, discountPercent);

  if (data.plan_type === "custom") {
    const input = toCustomInput(data);
    const r = resolveCustomPlan(input);
    const chatGbp = r.chatGbp === null ? null : priced(r.chatGbp);
    const voiceGbp = r.voiceGbp === null ? null : priced(r.voiceGbp);
    const startsAt = new Date().toISOString().slice(0, 10);
    return {
      tenant: {
        name: data.name, slug: data.slug, country: data.country, currency: "GBP",
        commercial_model: "custom", plan_type: "custom",
        monthly_price: (chatGbp ?? 0) + (voiceGbp ?? 0),
        dispatch_adapter: data.dispatch_adapter,
        dispatch_company_id: data.dispatch_company_id ?? null,
        contact_email: data.contact_email,
        coupon_code: data.coupon_code ?? null,
        discount_percent: discountPercent, billing_bypass: bypass,
        status: bypass ? "active" : "onboarding",
      },
      chat: input.includesChat ? { plan_tier: "custom", monthly_price_gbp: chatGbp ?? 0 } : null,
      voice: input.includesVoice
        ? {
            plan_tier: "custom",
            monthly_price_gbp: voiceGbp ?? 0,
            monthly_call_allowance: r.voiceAllowance ?? 0,
            included_agents: r.voiceAgents ?? 0,
          }
        : null,
      custom: {
        plan_name: input.planName,
        billing_mode: input.billingMode,
        includes_chat: input.includesChat,
        includes_voice: input.includesVoice,
        monthly_call_allowance: input.callAllowance,
        included_agents: input.includedAgents,
        price_per_call_gbp: input.pricePerCallGbp ?? null,
        plan_price_gbp: voiceGbp ?? input.planPriceGbp,
        chat_monthly_gbp: chatGbp,
        setup_fee_gbp: bypass ? 0 : applyDiscount(input.setupFeeGbp, discountPercent),
        validity_days: input.validityDays,
        extra_credit_price_gbp: input.extraCreditPriceGbp,
        starts_at: startsAt,
        expires_at: packExpiry(startsAt, input.validityDays),
      },
      setupGbp: bypass ? 0 : applyDiscount(input.setupFeeGbp, discountPercent),
    };
  }

  // Fixed base plan.
  const resolved = resolveBasePlanPricing(data.plan_type)!;
  const chatGbp = resolved.chatGbp === null ? null : priced(resolved.chatGbp) ?? 0;
  const voiceGbp = resolved.voiceGbp === null ? null : priced(resolved.voiceGbp) ?? 0;
  return {
    tenant: {
      name: data.name, slug: data.slug, country: data.country, currency: "GBP",
      commercial_model: planTypeCommercialModel(data.plan_type),
      plan_type: data.plan_type,
      monthly_price: (chatGbp ?? 0) + (voiceGbp ?? 0),
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email,
      coupon_code: data.coupon_code ?? null,
      discount_percent: discountPercent, billing_bypass: bypass,
      status: bypass ? "active" : "onboarding",
    },
    chat: resolved.chatGbp !== null ? { plan_tier: "ignition", monthly_price_gbp: chatGbp ?? 0 } : null,
    voice:
      resolved.voiceGbp !== null
        ? {
            plan_tier: "ignition",
            monthly_price_gbp: voiceGbp ?? 0,
            monthly_call_allowance: resolved.voiceAllowance ?? 0,
            included_agents: resolved.voiceAgents ?? 0,
          }
        : null,
    custom: null,
    setupGbp: bypass ? 0 : applyDiscount(resolved.setupGbp, discountPercent),
  };
}
