import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseLike } from "@/lib/dashboard/queries";

export interface BillingOverview {
  planBand: string | null;
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
}

export async function getBillingOverview(tenantId: string, client?: SupabaseLike): Promise<BillingOverview> {
  const supabase = client ?? (await createClient());

  const [tenantRes, subscriptionRes, setupFeeRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("plan_band, currency, monthly_price, contract_start, contract_renewal, setup_fee_paid, stripe_customer_id")
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
      .select("amount, currency, paid_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const t = (tenantRes.data as Record<string, unknown> | null) ?? null;
  const s = (subscriptionRes.data as Record<string, unknown> | null) ?? null;
  const f = (setupFeeRes.data as Record<string, unknown> | null) ?? null;

  return {
    planBand: t ? (t.plan_band as string | null) ?? null : null,
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
  };
}
