"use server";

import "server-only";
import { redirect } from "next/navigation";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { validateCoupon, redeemCoupon } from "@/lib/admin/coupons";
import {
  createTenantSchema,
  buildProvisioningRows,
  type TenantFormState,
} from "./provisioning";

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

  // formData.get() returns null for fields that were not rendered (e.g. the
  // voice tier select on a chat-only submission); zod's .optional() accepts
  // undefined but rejects null, so coerce here or hidden fields fail validation
  // with errors the form can never display.
  const field = (name: string) => formData.get(name) ?? undefined;
  const raw = {
    name: field("name"),
    slug: field("slug"),
    country: field("country"),
    contact_email: field("contact_email"),
    dispatch_adapter: field("dispatch_adapter"),
    dispatch_company_id: field("dispatch_company_id"),
    commercial_model: field("commercial_model"),
    chat_tier: field("chat_tier"),
    voice_tier: field("voice_tier"),
    coupon_code: field("coupon_code"),
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
    // The setup fee is part of the commercial contract; a tenant without one
    // would silently under-bill. Compensate (the chat/voice rows cascade) rather
    // than redirect to a half-provisioned tenant.
    console.error("createTenant: failed to record setup fee", feeError);
    return failProvision("Could not record the setup fee. Please try again.");
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
