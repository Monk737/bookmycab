import { describe, it, expect } from "vitest";
import {
  computeMRR,
  computeARR,
  mrrByPlanBand,
  renewalBuckets,
  daysUntil,
  setupFeePipeline,
  type BillingTenant,
  type BillingSetupFee,
} from "@/lib/admin/billing-math";

// Fixed reference date so all renewal math is deterministic.
const TODAY = new Date("2026-06-01T12:00:00Z");

/** Build a tenant with sensible defaults, overriding only what a test cares about. */
function tenant(overrides: Partial<BillingTenant>): BillingTenant {
  return {
    status: "active",
    currency: "GBP",
    monthly_price: 500,
    contract_renewal: null,
    plan_band: "A-Single",
    ...overrides,
  };
}

/** A renewal date `days` from TODAY, as a date-only ISO string. */
function renewalIn(days: number): string {
  const d = new Date(
    Date.UTC(
      TODAY.getUTCFullYear(),
      TODAY.getUTCMonth(),
      TODAY.getUTCDate() + days,
    ),
  );
  return d.toISOString().slice(0, 10);
}

describe("computeMRR", () => {
  it("sums monthly_price for active tenants, grouped by currency", () => {
    const tenants = [
      tenant({ status: "active", currency: "GBP", monthly_price: 500 }),
      tenant({ status: "active", currency: "GBP", monthly_price: 800 }),
      tenant({ status: "active", currency: "EUR", monthly_price: 1000 }),
      tenant({ status: "active", currency: "USD", monthly_price: 600 }),
    ];
    expect(computeMRR(tenants)).toEqual({ GBP: 1300, EUR: 1000, USD: 600 });
  });

  it("excludes onboarding, suspended and churned tenants", () => {
    const tenants = [
      tenant({ status: "active", monthly_price: 500 }),
      tenant({ status: "onboarding", monthly_price: 500 }),
      tenant({ status: "suspended", monthly_price: 500 }),
      tenant({ status: "churned", monthly_price: 500 }),
    ];
    expect(computeMRR(tenants)).toEqual({ GBP: 500, EUR: 0, USD: 0 });
  });

  it("treats Custom (null monthly_price) as 0 — no NaN", () => {
    const tenants = [
      tenant({ status: "active", plan_band: "Custom", monthly_price: null }),
      tenant({ status: "active", monthly_price: 500 }),
    ];
    expect(computeMRR(tenants)).toEqual({ GBP: 500, EUR: 0, USD: 0 });
  });

  it("coerces numeric-string prices from the DB", () => {
    const tenants = [
      tenant({ status: "active", monthly_price: "800" as unknown as number }),
    ];
    expect(computeMRR(tenants).GBP).toBe(800);
  });

  it("never mixes currencies into a single total", () => {
    const mrr = computeMRR([
      tenant({ currency: "GBP", monthly_price: 500 }),
      tenant({ currency: "EUR", monthly_price: 500 }),
    ]);
    expect(mrr.GBP).toBe(500);
    expect(mrr.EUR).toBe(500);
    // No combined field exists — totals stay per-currency.
  });

  it("returns zeroed currencies for an empty input", () => {
    expect(computeMRR([])).toEqual({ GBP: 0, EUR: 0, USD: 0 });
  });
});

describe("computeARR", () => {
  it("multiplies each currency's MRR by 12", () => {
    expect(computeARR({ GBP: 1300, EUR: 1000, USD: 600 })).toEqual({
      GBP: 15600,
      EUR: 12000,
      USD: 7200,
    });
  });
});

describe("mrrByPlanBand", () => {
  it("groups active MRR by band then currency, Custom present at 0", () => {
    const result = mrrByPlanBand([
      tenant({ plan_band: "A-Single", currency: "GBP", monthly_price: 500 }),
      tenant({ plan_band: "A-Single", currency: "GBP", monthly_price: 500 }),
      tenant({ plan_band: "B-Bundle", currency: "USD", monthly_price: 2000 }),
      tenant({ plan_band: "Custom", currency: "GBP", monthly_price: null }),
      tenant({
        plan_band: "B-Single",
        currency: "EUR",
        monthly_price: 800,
        status: "onboarding",
      }),
    ]);
    expect(result["A-Single"].GBP).toBe(1000);
    expect(result["B-Bundle"].USD).toBe(2000);
    expect(result["Custom"]).toEqual({ GBP: 0, EUR: 0, USD: 0 });
    // onboarding B-Single excluded
    expect(result["B-Single"].EUR).toBe(0);
  });

  it("includes all five bands even when empty", () => {
    const result = mrrByPlanBand([]);
    expect(Object.keys(result).sort()).toEqual(
      ["A-Bundle", "A-Single", "B-Bundle", "B-Single", "Custom"].sort(),
    );
  });
});

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    expect(daysUntil(renewalIn(0), TODAY)).toBe(0);
  });
  it("returns positive whole days for a future date", () => {
    expect(daysUntil(renewalIn(7), TODAY)).toBe(7);
  });
  it("returns negative for a past-due date", () => {
    expect(daysUntil(renewalIn(-3), TODAY)).toBe(-3);
  });
  it("returns NaN for an invalid date string", () => {
    expect(daysUntil("not-a-date", TODAY)).toBeNaN();
  });
});

describe("renewalBuckets (cumulative, boundary-inclusive)", () => {
  it("counts a renewal exactly 7 days out in the 7-day bucket", () => {
    const b = renewalBuckets([tenant({ contract_renewal: renewalIn(7) })], TODAY);
    expect(b[7]).toBe(1);
    expect(b[14]).toBe(1); // cumulative
    expect(b[90]).toBe(1);
  });

  it("counts a renewal 8 days out in 14+ but NOT in 7", () => {
    const b = renewalBuckets([tenant({ contract_renewal: renewalIn(8) })], TODAY);
    expect(b[7]).toBe(0);
    expect(b[14]).toBe(1);
    expect(b[30]).toBe(1);
  });

  it("counts a renewal today (0 days) in every bucket", () => {
    const b = renewalBuckets([tenant({ contract_renewal: renewalIn(0) })], TODAY);
    expect(b).toEqual({ 7: 1, 14: 1, 30: 1, 60: 1, 90: 1 });
  });

  it("excludes past-due renewals from all forward buckets", () => {
    const b = renewalBuckets([tenant({ contract_renewal: renewalIn(-1) })], TODAY);
    expect(b).toEqual({ 7: 0, 14: 0, 30: 0, 60: 0, 90: 0 });
  });

  it("excludes tenants with a null contract_renewal", () => {
    const b = renewalBuckets([tenant({ contract_renewal: null })], TODAY);
    expect(b).toEqual({ 7: 0, 14: 0, 30: 0, 60: 0, 90: 0 });
  });

  it("excludes non-active tenants", () => {
    const b = renewalBuckets(
      [tenant({ status: "suspended", contract_renewal: renewalIn(3) })],
      TODAY,
    );
    expect(b[7]).toBe(0);
  });

  it("accumulates several tenants across windows", () => {
    const b = renewalBuckets(
      [
        tenant({ contract_renewal: renewalIn(5) }), // 7,14,30,60,90
        tenant({ contract_renewal: renewalIn(20) }), // 30,60,90
        tenant({ contract_renewal: renewalIn(75) }), // 90
        tenant({ contract_renewal: renewalIn(120) }), // none
      ],
      TODAY,
    );
    expect(b).toEqual({ 7: 1, 14: 1, 30: 2, 60: 2, 90: 3 });
  });
});

describe("setupFeePipeline", () => {
  it("lists only unpaid fees and totals them per currency", () => {
    const fees: BillingSetupFee[] = [
      { tenant_id: "t1", amount: 1000, currency: "GBP", paid_at: null },
      { tenant_id: "t2", amount: 1200, currency: "USD", paid_at: null },
      {
        tenant_id: "t3",
        amount: 1000,
        currency: "GBP",
        paid_at: "2026-05-01T00:00:00Z",
      },
      { tenant_id: "t4", amount: 1000, currency: "EUR", paid_at: null },
    ];
    const { totalByCurrency, outstanding } = setupFeePipeline(fees);
    expect(totalByCurrency).toEqual({ GBP: 1000, EUR: 1000, USD: 1200 });
    expect(outstanding).toHaveLength(3);
    expect(outstanding.map((o) => o.tenant_id)).toEqual(["t1", "t2", "t4"]);
  });

  it("coerces null/string amounts and never mixes currencies", () => {
    const fees: BillingSetupFee[] = [
      { tenant_id: "t1", amount: null, currency: "GBP", paid_at: null },
      {
        tenant_id: "t2",
        amount: "1200" as unknown as number,
        currency: "USD",
        paid_at: null,
      },
    ];
    const { totalByCurrency } = setupFeePipeline(fees);
    expect(totalByCurrency).toEqual({ GBP: 0, EUR: 0, USD: 1200 });
  });

  it("returns empty pipeline for no fees", () => {
    expect(setupFeePipeline([])).toEqual({
      totalByCurrency: { GBP: 0, EUR: 0, USD: 0 },
      outstanding: [],
    });
  });
});
