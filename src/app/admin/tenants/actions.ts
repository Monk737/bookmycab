"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import {
  resolveNewModelPricing,
  type CommercialModel,
  type NewTierKey,
  type ChatChannelMode,
} from "@/lib/billing/pricing";
import { validateCoupon, applyDiscount, redeemCoupon } from "@/lib/admin/coupons";
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
const CHANNEL_MODES = ["single", "bundle"] as const;
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
    chat_channel_mode: z.enum(CHANNEL_MODES).optional(),
    voice_tier: z.enum(TIERS).optional(),
    chat_price_override: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
        message: "Price must be ≥ 0.",
      })
      .optional(),
    coupon_code: optionalText,
  })
  .superRefine((d, ctx) => {
    const hasChat = d.commercial_model === "chat" || d.commercial_model === "double_decker";
    const hasVoice = d.commercial_model === "voice" || d.commercial_model === "double_decker";
    if (hasChat && !d.chat_tier)
      ctx.addIssue({ code: "custom", path: ["chat_tier"], message: "Pick a chat tier." });
    if (hasChat && !d.chat_channel_mode)
      ctx.addIssue({ code: "custom", path: ["chat_channel_mode"], message: "Pick a channel mode." });
    if (hasVoice && !d.voice_tier)
      ctx.addIssue({ code: "custom", path: ["voice_tier"], message: "Pick a voice tier." });
    // Only CHAT-ONLY Full Throttle is quoted (no list price). Double Decker
    // Full Throttle has an authored price, so it needs no override.
    if (
      d.commercial_model === "chat" &&
      d.chat_tier === "full_throttle" &&
      d.chat_price_override === undefined
    )
      ctx.addIssue({
        code: "custom",
        path: ["chat_price_override"],
        message: "Enter a quoted monthly price for Full Throttle.",
      });
  });

export type CreateTenantData = z.infer<typeof createTenantSchema>;

export interface ProvisioningRows {
  tenant: {
    name: string;
    slug: string;
    country: string;
    currency: "GBP";
    plan_band: null;
    commercial_model: CommercialModel;
    dispatch_adapter: string;
    dispatch_company_id: string | null;
    contact_email: string;
    coupon_code: string | null;
    discount_percent: number;
    billing_bypass: boolean;
    status: "onboarding" | "active";
  };
  chat: { plan_tier: NewTierKey; channel_mode: ChatChannelMode; monthly_price_gbp: number } | null;
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
    chatMode: data.chat_channel_mode ?? null,
    voiceTier: data.voice_tier ?? null,
  });

  // Full Throttle chat: use the admin override.
  // Manual override applies ONLY to chat-only Full Throttle (the quoted tier);
  // Double Decker Full Throttle uses the authored bundle chat component.
  const chatBase =
    data.commercial_model === "chat" && data.chat_tier === "full_throttle"
      ? data.chat_price_override ?? 0
      : resolved.chatGbp;

  const priced = (base: number | null): number | null =>
    base === null ? null : bypass ? 0 : applyDiscount(base, discountPercent);

  const hasChat = data.commercial_model === "chat" || data.commercial_model === "double_decker";
  const hasVoice = data.commercial_model === "voice" || data.commercial_model === "double_decker";

  return {
    tenant: {
      name: data.name,
      slug: data.slug,
      country: data.country,
      currency: "GBP",
      plan_band: null,
      commercial_model: data.commercial_model,
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email,
      coupon_code: data.coupon_code ?? null,
      discount_percent: discountPercent,
      billing_bypass: bypass,
      status: bypass ? "active" : "onboarding",
    },
    chat:
      hasChat && data.chat_tier && data.chat_channel_mode
        ? {
            plan_tier: data.chat_tier,
            channel_mode: data.chat_channel_mode,
            monthly_price_gbp: priced(chatBase) ?? 0,
          }
        : null,
    voice:
      hasVoice && data.voice_tier
        ? {
            plan_tier: data.voice_tier,
            monthly_price_gbp: priced(resolved.voiceGbp) ?? 0,
            monthly_call_allowance: resolved.voiceAllowance ?? 0,
            included_agents: resolved.voiceAgents ?? 0,
          }
        : null,
    setupGbp: bypass ? 0 : applyDiscount(resolved.setupGbp, discountPercent),
  };
}

/**
 * Provisions a new tenant on the new commercial model (Chat / Voice / Double
 * Decker, GBP only).
 *
 * Defense-in-depth: re-checks staff access (middleware already gates /admin).
 * Validates with zod, computes prices via `buildProvisioningRows`, then inserts
 * the `tenants` row + chat/voice subscription rows + a `setup_fees` row via the
 * service-role client (admin provisioning is cross-tenant; RLS would block a
 * normal write). A 100%-off coupon comps every subscription locally (no Stripe).
 * Records a `tenant.create` audit entry and redirects to the tenant detail page.
 */
export async function createTenant(
  _prevState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const claims = await requireStaff();

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    country: formData.get("country"),
    contact_email: formData.get("contact_email"),
    dispatch_adapter: formData.get("dispatch_adapter"),
    dispatch_company_id: formData.get("dispatch_company_id"),
    commercial_model: formData.get("commercial_model"),
    chat_tier: formData.get("chat_tier"),
    chat_channel_mode: formData.get("chat_channel_mode"),
    voice_tier: formData.get("voice_tier"),
    chat_price_override: formData.get("chat_price_override"),
    coupon_code: formData.get("coupon_code"),
  };

  const parsed = createTenantSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const data = parsed.data;

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Validate the coupon up front so an invalid code fails before any insert.
  let discountPercent = 0;
  let appliedCoupon: { id: string; code: string; times_redeemed: number } | null = null;
  if (data.coupon_code) {
    const check = await validateCoupon(serviceClient, data.coupon_code);
    if (!check.ok) {
      return { fieldErrors: { coupon_code: [check.error] }, formError: null };
    }
    discountPercent = check.coupon.percent_off;
    appliedCoupon = {
      id: check.coupon.id,
      code: check.coupon.code,
      times_redeemed: check.coupon.times_redeemed,
    };
  }

  // A 100%-off coupon fully comps the tenant: zero price, Stripe bypassed.
  const bypass = discountPercent === 100;

  // Compute the tenant + subscription rows (pure, discount/bypass applied).
  const rows = buildProvisioningRows({ data, discountPercent, bypass });

  const { data: inserted, error: insertError } = await serviceClient
    .from("tenants")
    .insert(rows.tenant)
    .select("id")
    .single();

  if (insertError || !inserted) {
    // 23505 = unique_violation; only treat it as a slug clash when the failing
    // constraint actually references slug (otherwise surface a generic error).
    const isDuplicateSlug =
      insertError?.code === "23505" &&
      (insertError.message?.includes("slug") ||
        insertError.details?.includes("slug"));
    return {
      fieldErrors: isDuplicateSlug
        ? { slug: ["That slug is already taken."] }
        : {},
      formError: isDuplicateSlug
        ? null
        : "Could not create the tenant. Please try again.",
    };
  }

  const tenantId = inserted.id as string;

  // Compensate when a CORE subscription insert fails: remove the
  // partially-provisioned tenant (chat/voice rows cascade on the tenant_id FK)
  // and surface the error instead of redirecting to a broken success page.
  async function failProvision(message: string): Promise<TenantFormState> {
    const { error: delErr } = await serviceClient.from("tenants").delete().eq("id", tenantId);
    if (delErr) {
      console.error("createTenant: compensating tenant delete failed", { tenantId, delErr });
    }
    return { fieldErrors: {}, formError: message };
  }

  // Non-bypass subscriptions are inserted with the DB default status 'active'
  // and a null stripe_subscription_id; B3 "Start billing" + the Stripe webhook
  // backfill the Stripe id + billing periods. (The status CHECK has no 'pending'.)
  //
  // A bypassed tenant has its subscriptions comped to active locally, mirroring
  // the shape the Stripe webhook would have written (synthetic comp id, period
  // running from now for one month).
  const nowIso = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const periodEndIso = periodEnd.toISOString();

  // Insert the chat subscription row when the model includes chat.
  if (rows.chat) {
    const { error: chatError } = await serviceClient.from("chat_subscriptions").insert({
      tenant_id: tenantId,
      ...rows.chat,
      ...(bypass
        ? {
            status: "active",
            stripe_subscription_id: `comp_${tenantId}_chat`,
            current_period_start: nowIso,
            current_period_end: periodEndIso,
          }
        : {}),
    });
    if (chatError) {
      console.error("createTenant: failed to record chat subscription", chatError);
      return failProvision("Could not create the chat subscription. Please try again.");
    }
  }

  // Insert the voice subscription row when the model includes voice.
  if (rows.voice) {
    const { error: voiceError } = await serviceClient.from("voice_subscriptions").insert({
      tenant_id: tenantId,
      ...rows.voice,
      ...(bypass
        ? {
            status: "active",
            stripe_subscription_id: `comp_${tenantId}_voice`,
            current_period_start: nowIso,
            current_period_end: periodEndIso,
          }
        : {}),
    });
    if (voiceError) {
      console.error("createTenant: failed to record voice subscription", voiceError);
      return failProvision("Could not create the voice subscription. Please try again.");
    }
  }

  // Capture the one-time setup fee. A bypassed (100%-off) tenant has its setup
  // fee comped to 0 and marked paid; otherwise it is recorded unpaid.
  const { error: feeError } = await serviceClient.from("setup_fees").insert({
    tenant_id: tenantId,
    amount: rows.setupGbp,
    currency: "GBP",
    paid_at: bypass ? nowIso : null,
  });
  if (feeError) {
    console.error("createTenant: failed to record setup fee", feeError);
  }

  // Record the coupon redemption (best-effort; logged on failure).
  if (appliedCoupon) {
    const redeemed = await redeemCoupon(serviceClient, appliedCoupon);
    if (!redeemed) {
      console.error("createTenant: failed to record coupon redemption", {
        coupon: appliedCoupon.code,
        tenantId,
      });
    }
  }

  // Audit the provisioning action against the acting staff user. `requireStaff`
  // guarantees `claims` is non-null, so the audit always fires after a
  // successful insert.
  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.create",
    targetType: "tenant",
    targetId: tenantId,
    metadata: {
      name: data.name,
      commercial_model: data.commercial_model,
      chat_tier: data.chat_tier ?? null,
      voice_tier: data.voice_tier ?? null,
      currency: "GBP",
      coupon_code: appliedCoupon?.code ?? null,
      discount_percent: discountPercent,
      billing_bypass: bypass,
    },
  });
  if (!audited) {
    console.error("audit write failed for tenant.create", { tenantId });
  }

  redirect(`/admin/tenants/${tenantId}`);
}
