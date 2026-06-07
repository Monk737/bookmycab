"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { CURRENCIES, CONTRACT_MONTHS } from "@/lib/marketing/pricing";
import { PLAN_BANDS } from "@/lib/admin/plan-bands";
import { validateCoupon, applyDiscount, redeemCoupon } from "@/lib/admin/coupons";
import { COUNTRY_CODES } from "@/lib/billing/country";
import { addMonthsUTC } from "@/lib/billing/dates";

/** Form-state shape for the provisioning form (mirrors the auth AuthState). */
export type TenantFormState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
};

const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;

// Empty-string optional helper: turns "" into undefined so optional fields are
// not tripped by blank inputs.
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

const createTenantSchema = z.object({
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
  plan_band: z.enum(PLAN_BANDS),
  currency: z.enum(CURRENCIES),
  dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
  dispatch_company_id: optionalText,
  contact_email: z.string().trim().email("Enter a valid contact email."),
  contract_start: optionalText,
  // monthly_price: blank allowed (Custom may be quoted later); when present must be ≥ 0.
  monthly_price: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Monthly price must be a non-negative number.",
    })
    .optional(),
  stripe_customer_id: optionalText,
  // setup_fee amount → stored as a setup_fees row when provided.
  setup_fee: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Setup fee must be a non-negative number.",
    })
    .optional(),
  // Optional discount coupon, validated against public.coupons. A 100%-off code
  // fully comps the tenant and bypasses Stripe (handled in createTenant).
  coupon_code: optionalText,
});

/**
 * Provisions a new tenant.
 *
 * Defense-in-depth: re-checks staff access (middleware already gates /admin).
 * Validates with zod, inserts into `public.tenants` via the service-role client
 * (admin provisioning is cross-tenant; RLS would block a normal write), records
 * an audit entry, and,when a setup fee amount is supplied,inserts an unpaid
 * `setup_fees` row. On success redirects to the tenant detail page (Task 4).
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
    plan_band: formData.get("plan_band"),
    currency: formData.get("currency"),
    dispatch_adapter: formData.get("dispatch_adapter"),
    dispatch_company_id: formData.get("dispatch_company_id"),
    contact_email: formData.get("contact_email"),
    contract_start: formData.get("contract_start"),
    monthly_price: formData.get("monthly_price"),
    stripe_customer_id: formData.get("stripe_customer_id"),
    setup_fee: formData.get("setup_fee"),
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

  // Apply the discount to the recorded monthly price + setup fee. A bypassed
  // tenant is forced to 0 even when no base price was entered.
  const monthlyPrice = bypass
    ? 0
    : data.monthly_price === undefined
      ? null
      : applyDiscount(data.monthly_price, discountPercent);
  // Only record a setup fee when the admin entered one. Bypassed → comped to 0
  // and marked paid below; otherwise the discount is applied to the amount.
  const setupAmount =
    data.setup_fee === undefined
      ? undefined
      : bypass
        ? 0
        : applyDiscount(data.setup_fee, discountPercent);

  const today = new Date().toISOString().slice(0, 10);
  const renewal = bypass ? addMonthsUTC(today, CONTRACT_MONTHS) : null;

  const { data: inserted, error: insertError } = await serviceClient
    .from("tenants")
    .insert({
      name: data.name,
      slug: data.slug,
      country: data.country,
      plan_band: data.plan_band,
      currency: data.currency,
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email,
      stripe_customer_id: data.stripe_customer_id ?? null,
      contract_start: bypass ? today : data.contract_start ?? null,
      contract_renewal: renewal,
      monthly_price: monthlyPrice,
      coupon_code: appliedCoupon?.code ?? null,
      discount_percent: discountPercent,
      billing_bypass: bypass,
      status: bypass ? "active" : "onboarding",
    })
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

  // Capture the setup fee as a setup_fees row when an amount is given. A
  // bypassed (100%-off) tenant has its setup fee comped to 0 and marked paid.
  if (setupAmount !== undefined) {
    const { error: feeError } = await serviceClient.from("setup_fees").insert({
      tenant_id: tenantId,
      amount: setupAmount,
      currency: data.currency,
      paid_at: bypass ? new Date().toISOString() : null,
    });
    if (feeError) {
      console.error("createTenant: failed to record setup fee", feeError);
    }
  }

  // 100%-off bypass: comp the subscription locally so the tenant is fully active
  // without ever touching Stripe. We mirror a zero-price active subscription
  // (synthetic comp id) the same shape the Stripe webhook would have written.
  if (bypass) {
    const nowIso = new Date().toISOString();
    const { error: subError } = await serviceClient.from("subscriptions").insert({
      tenant_id: tenantId,
      stripe_sub_id: `comp_${tenantId}`,
      plan_band: data.plan_band,
      monthly_price: 0,
      currency: data.currency,
      status: "active",
      current_period_start: nowIso,
      current_period_end: renewal,
      contract_end: renewal,
    });
    if (subError) {
      console.error("createTenant: failed to record comp subscription", subError);
    }
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
      plan_band: data.plan_band,
      currency: data.currency,
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
