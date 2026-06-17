import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseLike } from "@/lib/dashboard/queries";

export interface ProductPlan {
  tier: string | null;
  monthlyGbp: number;
}
export interface VoiceProductPlan extends ProductPlan {
  allowance: number;
}

/** New-model plan summary (chat/voice subscriptions). Null for legacy tenants. */
export interface ProductsSummary {
  chat: ProductPlan | null;
  voice: VoiceProductPlan | null;
  combinedMonthlyGbp: number;
}

export interface BillingOverview {
  commercialModel: "chat" | "voice" | "double_decker" | "custom" | null;
  /** New-model plan summary; null when the tenant has no chat/voice product yet. */
  products: ProductsSummary | null;
  currency: string | null;
  monthlyPrice: number | null;
  contractStart: string | null;
  contractRenewal: string | null;
  setupFeePaid: boolean | null;
  stripeCustomerId: string | null;
  subscription: {
    planBand: string | null;
    monthlyPrice: number | null;
    currency: string | null;
    status: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    contractEnd: string | null;
  } | null;
  setupFee: {
    amount: number | null;
    currency: string | null;
    paidAt: string | null;
  } | null;
  custom: {
    planName: string;
    billingMode: "recurring" | "one_time";
    callAllowance: number;
    includedAgents: number;
    planPriceGbp: number;
    extraCreditPriceGbp: number;
    validityDays: number;
    startsAt: string | null;
    expiresAt: string | null;
  } | null;
  activationInvoiceUrl: string | null;
}

export async function getBillingOverview(tenantId: string, client?: SupabaseLike): Promise<BillingOverview> {
  const supabase = client ?? (await createClient());

  const [tenantRes, subscriptionRes, setupFeeRes, chatSubRes, voiceSubRes, customRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("currency, monthly_price, contract_start, contract_renewal, setup_fee_paid, stripe_customer_id, commercial_model")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_band, monthly_price, currency, status, current_period_start, current_period_end, contract_end")
      .eq("tenant_id", tenantId)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("setup_fees")
      .select("amount, currency, paid_at, hosted_invoice_url")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("chat_subscriptions")
      .select("plan_tier, monthly_price_gbp")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("voice_subscriptions")
      .select("plan_tier, monthly_price_gbp, monthly_call_allowance")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("custom_plans")
      .select("plan_name, billing_mode, monthly_call_allowance, included_agents, plan_price_gbp, extra_credit_price_gbp, validity_days, starts_at, expires_at")
      .eq("tenant_id", tenantId).maybeSingle(),
  ]);

  const t = (tenantRes.data as Record<string, unknown> | null) ?? null;
  const s = (subscriptionRes.data as Record<string, unknown> | null) ?? null;
  const f = (setupFeeRes.data as Record<string, unknown> | null) ?? null;
  const chatSub = (chatSubRes.data as Record<string, unknown> | null) ?? null;
  const voiceSub = (voiceSubRes.data as Record<string, unknown> | null) ?? null;
  const cp = (customRes.data as Record<string, unknown> | null) ?? null;
  const custom = cp ? {
    planName: String(cp.plan_name ?? ""),
    billingMode: (cp.billing_mode as "recurring" | "one_time"),
    callAllowance: Number(cp.monthly_call_allowance ?? 0),
    includedAgents: Number(cp.included_agents ?? 0),
    planPriceGbp: Number(cp.plan_price_gbp ?? 0),
    extraCreditPriceGbp: Number(cp.extra_credit_price_gbp ?? 0),
    validityDays: Number(cp.validity_days ?? 0),
    startsAt: (cp.starts_at as string | null) ?? null,
    expiresAt: (cp.expires_at as string | null) ?? null,
  } : null;

  const chatPlan: ProductPlan | null = chatSub
    ? { tier: (chatSub.plan_tier as string | null) ?? null, monthlyGbp: Number(chatSub.monthly_price_gbp ?? 0) }
    : null;
  const voicePlan: VoiceProductPlan | null = voiceSub
    ? {
        tier: (voiceSub.plan_tier as string | null) ?? null,
        monthlyGbp: Number(voiceSub.monthly_price_gbp ?? 0),
        allowance: Number(voiceSub.monthly_call_allowance ?? 0),
      }
    : null;
  const products: ProductsSummary | null =
    chatPlan || voicePlan
      ? { chat: chatPlan, voice: voicePlan, combinedMonthlyGbp: (chatPlan?.monthlyGbp ?? 0) + (voicePlan?.monthlyGbp ?? 0) }
      : null;

  return {
    commercialModel: (t?.commercial_model as BillingOverview["commercialModel"]) ?? null,
    products,
    currency: t ? (t.currency as string | null) ?? null : null,
    monthlyPrice: t ? (t.monthly_price as number | null) ?? null : null,
    contractStart: t ? (t.contract_start as string | null) ?? null : null,
    contractRenewal: t ? (t.contract_renewal as string | null) ?? null : null,
    setupFeePaid: t ? (t.setup_fee_paid as boolean | null) ?? null : null,
    stripeCustomerId: t ? (t.stripe_customer_id as string | null) ?? null : null,
    subscription: s
      ? {
          planBand: (s.plan_band as string | null) ?? null,
          monthlyPrice: (s.monthly_price as number | null) ?? null,
          currency: (s.currency as string | null) ?? null,
          status: (s.status as string | null) ?? null,
          currentPeriodStart: (s.current_period_start as string | null) ?? null,
          currentPeriodEnd: (s.current_period_end as string | null) ?? null,
          contractEnd: (s.contract_end as string | null) ?? null,
        }
      : null,
    setupFee: f
      ? {
          amount: (f.amount as number | null) ?? null,
          currency: (f.currency as string | null) ?? null,
          paidAt: (f.paid_at as string | null) ?? null,
        }
      : null,
    custom,
    activationInvoiceUrl: (f?.hosted_invoice_url as string | null) ?? null,
  };
}
