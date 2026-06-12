/**
 * Pure billing math over LOCAL tenant/setup-fee data.
 *
 * SCOPE (Epic 3): these functions compute MRR/ARR, renewal alert buckets, and
 * the setup-fee pipeline entirely from local Supabase tables. There are NO live
 * Stripe calls anywhere here, Epic 8 will reconcile these figures against the
 * `subscriptions` mirror once Stripe is wired up. // TODO(epic-8)
 *
 * SOURCE OF TRUTH (today): `tenants.monthly_price`. It is always populated at
 * provisioning time, whereas the `subscriptions` table stays empty until Epic 8.
 * So MRR/renewals are derived from tenants; Epic 8 reconciles. // TODO(epic-8)
 *
 * CURRENCY: amounts are NEVER summed across currencies, mixing £/€/$ into one
 * number is meaningless. Every total is grouped by currency (`MrrByCurrency`).
 *
 * All functions are pure (no I/O, no clock reads): `today` is injected so the
 * renewal math is deterministic and testable.
 */

import { CURRENCIES, type Currency } from "@/lib/marketing/pricing";
import type { CommercialModel } from "@/lib/billing/pricing";

/** Minimal tenant shape these functions need. Mirrors `tenants` columns. */
export type BillingTenant = {
  status: string; // onboarding | active | suspended | churned
  currency: Currency;
  /** numeric column; null for quoted / not-yet-priced tenants. */
  monthly_price: number | string | null;
  /** ISO date string (date column) or null when no contract renewal set. */
  contract_renewal: string | null;
  /** "chat" | "voice" | "double_decker" | null (not yet set). */
  commercial_model: CommercialModel | string | null;
};

/** Minimal setup-fee shape. Mirrors `setup_fees` columns. */
export type BillingSetupFee = {
  id: string;
  tenant_id: string;
  amount: number | string | null;
  currency: Currency;
  /** null = unpaid (outstanding). */
  paid_at: string | null;
};

/** A monetary total per currency. Currencies are never summed together. */
export type MrrByCurrency = Record<Currency, number>;

/** The renewal alert windows, in days. 90 is included for the churn-risk view. */
export const RENEWAL_WINDOWS = [7, 14, 30, 60, 90] as const;
export type RenewalWindow = (typeof RENEWAL_WINDOWS)[number];

/** Renewal buckets are CUMULATIVE ("within N days"): a renewal 5 days out
 *  appears in 7, 14, 30, 60 AND 90. Cumulative is the most useful framing for
 *  alerts ("how many renew within 30 days?"). Past-due (negative days) tenants
 *  are NOT counted in any forward window, they are surfaced separately. */
export type RenewalBuckets = Record<RenewalWindow, number>;

/** Zeroed per-currency accumulator. */
function emptyByCurrency(): MrrByCurrency {
  return CURRENCIES.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {} as MrrByCurrency);
}

/** Coerce a numeric/string/null DB value to a finite, non-negative number. */
function toPrice(value: number | string | null): number {
  if (value == null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** True for tenants that contribute to recurring revenue. */
function isActive(t: { status: string }): boolean {
  return t.status === "active";
}

/**
 * MRR = sum of `monthly_price` over ACTIVE tenants, grouped by currency.
 *
 * Excludes onboarding / suspended / churned tenants (not yet, or no longer,
 * billing). Custom tenants have a null `monthly_price` → contribute 0 (their
 * bespoke fee is not tracked in this column today). // TODO(epic-8): pull
 * Custom MRR from the `subscriptions` mirror.
 */
export function computeMRR(tenants: BillingTenant[]): MrrByCurrency {
  const mrr = emptyByCurrency();
  for (const t of tenants) {
    if (!isActive(t)) continue;
    mrr[t.currency] += toPrice(t.monthly_price);
  }
  return mrr;
}

/** ARR = MRR × 12, per currency. Currencies are kept separate. */
export function computeARR(mrrByCurrency: MrrByCurrency): MrrByCurrency {
  const arr = emptyByCurrency();
  for (const c of CURRENCIES) arr[c] = mrrByCurrency[c] * 12;
  return arr;
}

/** The product breakdown keys (commercial models + an "unset" bucket). */
export const COMMERCIAL_MODELS = ["chat", "voice", "double_decker"] as const;
export type CommercialModelKey = (typeof COMMERCIAL_MODELS)[number] | "unset";

/**
 * Active MRR grouped by commercial model, then by currency. Tenants with no
 * commercial_model set are bucketed under "unset" so the breakdown is total.
 */
export function mrrByCommercialModel(
  tenants: BillingTenant[],
): Record<CommercialModelKey, MrrByCurrency> {
  const keys: CommercialModelKey[] = [...COMMERCIAL_MODELS, "unset"];
  const result = keys.reduce(
    (acc, k) => {
      acc[k] = emptyByCurrency();
      return acc;
    },
    {} as Record<CommercialModelKey, MrrByCurrency>,
  );
  for (const t of tenants) {
    if (!isActive(t)) continue;
    const key: CommercialModelKey =
      t.commercial_model === "chat" ||
      t.commercial_model === "voice" ||
      t.commercial_model === "double_decker"
        ? t.commercial_model
        : "unset";
    result[key][t.currency] += toPrice(t.monthly_price);
  }
  return result;
}

/** Whole days from `today` until `renewal` (both date-only). Negative = past. */
export function daysUntil(renewal: string, today: Date): number {
  const r = new Date(renewal);
  if (Number.isNaN(r.getTime())) return Number.NaN;
  // Compare at UTC midnight so partial days don't skew the bucket boundary.
  const startOfDay = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const ms = startOfDay(r) - startOfDay(today);
  return Math.round(ms / 86_400_000);
}

/**
 * Bucket ACTIVE tenants by days-until-renewal into cumulative windows.
 *
 * Cumulative: a tenant renewing in 5 days counts in 7/14/30/60/90; one renewing
 * in exactly 7 days counts in 7 (boundary inclusive); in 8 days counts in 14+
 * but NOT 7. Tenants with a null `contract_renewal` are excluded entirely.
 * Past-due renewals (days < 0) are excluded from forward windows.
 */
export function renewalBuckets(
  tenants: BillingTenant[],
  today: Date,
): RenewalBuckets {
  const buckets = RENEWAL_WINDOWS.reduce((acc, w) => {
    acc[w] = 0;
    return acc;
  }, {} as RenewalBuckets);

  for (const t of tenants) {
    if (!isActive(t)) continue;
    if (!t.contract_renewal) continue;
    const days = daysUntil(t.contract_renewal, today);
    if (Number.isNaN(days) || days < 0) continue;
    for (const w of RENEWAL_WINDOWS) {
      if (days <= w) buckets[w] += 1;
    }
  }
  return buckets;
}

/** One outstanding setup fee, plus the resolved numeric amount. */
export type OutstandingSetupFee = {
  id: string;
  tenant_id: string;
  amount: number;
  currency: Currency;
};

/** Outstanding (unpaid) setup fees: per-currency totals + the line items. */
export type SetupFeePipeline = {
  totalByCurrency: MrrByCurrency;
  outstanding: OutstandingSetupFee[];
};

/**
 * Outstanding setup-fee pipeline: every fee with `paid_at == null`, totalled
 * per currency (never summed across currencies) plus the individual line items.
 */
export function setupFeePipeline(
  setupFees: BillingSetupFee[],
): SetupFeePipeline {
  const totalByCurrency = emptyByCurrency();
  const outstanding: OutstandingSetupFee[] = [];
  for (const f of setupFees) {
    if (f.paid_at != null) continue; // paid → not outstanding
    const amount = toPrice(f.amount);
    totalByCurrency[f.currency] += amount;
    outstanding.push({
      id: f.id,
      tenant_id: f.tenant_id,
      amount,
      currency: f.currency,
    });
  }
  return { totalByCurrency, outstanding };
}
