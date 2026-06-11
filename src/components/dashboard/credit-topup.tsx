"use client";

import { useState } from "react";
import {
  CREDIT_PACKS,
  MIN_TOPUP_GBP,
  creditsForGbp,
  validateCustomTopup,
} from "@/lib/billing/credit";

interface CreditTopupProps {
  orgId: string;
  /** Current prepaid voice credit balance (credits). */
  balance: number;
  /** Remaining plan calls this calendar month. */
  remainingCalls: number;
  /** Monthly plan call allowance. */
  allowance: number;
}

export function CreditTopup({
  orgId,
  balance,
  remainingCalls,
  allowance,
}: CreditTopupProps) {
  const [coupon, setCoupon] = useState("");
  const [customGbp, setCustomGbp] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customNum = customGbp === "" ? NaN : Number(customGbp);
  const customValidation = customGbp === "" ? null : validateCustomTopup(customNum);
  const customCredits =
    customValidation?.ok ? customValidation.credits : Number.isFinite(customNum) ? creditsForGbp(customNum) : 0;

  async function startCheckout(payload: { packId?: string; customGbp?: number }) {
    setError(null);
    const couponCode = coupon.trim() || undefined;
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/credit/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, couponCode }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setError(json.error ?? "Could not start the top-up. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  function buyPack(packId: string) {
    setLoading(packId);
    void startCheckout({ packId });
  }

  function buyCustom() {
    const v = validateCustomTopup(customNum);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setLoading("custom");
    void startCheckout({ customGbp: customNum });
  }

  return (
    <section
      aria-labelledby="credit-heading"
      className="border-[3px] border-ink bg-paper p-6 shadow-brut-sm space-y-5"
    >
      <h2
        id="credit-heading"
        className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
      >
        Voice credit
      </h2>

      {/* Balances */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-gray-500">Credit balance</dt>
          <dd className="mt-0.5 text-sm font-bold text-ink">
            {balance.toLocaleString("en-GB")} {balance === 1 ? "credit" : "credits"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Plan calls remaining</dt>
          <dd className="mt-0.5 text-sm font-bold text-ink">
            {remainingCalls.toLocaleString("en-GB")} of {allowance.toLocaleString("en-GB")} this month
          </dd>
        </div>
      </dl>

      {/* Packs */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">Buy a credit pack</p>
        <div className="flex flex-wrap gap-3">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => buyPack(pack.id)}
              disabled={loading !== null}
              className="inline-flex items-center justify-center border-[3px] border-ink bg-brut-yellow px-4 py-2.5 text-sm font-bold text-ink shadow-brut-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {loading === pack.id ? "Loading…" : `£${pack.gbp} · ${pack.credits} credits`}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div className="space-y-2">
        <label htmlFor="custom-topup" className="block text-xs font-medium text-gray-500">
          Or enter a custom amount (£)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="custom-topup"
            type="number"
            inputMode="decimal"
            min={MIN_TOPUP_GBP}
            step="1"
            value={customGbp}
            onChange={(e) => {
              setCustomGbp(e.target.value);
              setError(null);
            }}
            placeholder={`${MIN_TOPUP_GBP}`}
            className="w-32 border-[3px] border-ink bg-paper px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
          {customGbp !== "" && (
            <span className="text-sm font-medium text-gray-700">= {customCredits} credits</span>
          )}
          <button
            type="button"
            onClick={buyCustom}
            disabled={loading !== null || customGbp === "" || customValidation?.ok === false}
            className="inline-flex items-center justify-center border-[3px] border-ink bg-paper px-4 py-2 text-sm font-bold text-ink shadow-brut-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {loading === "custom" ? "Loading…" : "Buy"}
          </button>
        </div>
        {customValidation && !customValidation.ok && (
          <p className="text-sm text-ink font-medium">{customValidation.error}</p>
        )}
      </div>

      {/* Coupon */}
      <div className="space-y-2">
        <label htmlFor="credit-coupon" className="block text-xs font-medium text-gray-500">
          Coupon code (optional)
        </label>
        <input
          id="credit-coupon"
          type="text"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="e.g. WELCOME10"
          className="w-full max-w-xs border-[3px] border-ink bg-paper px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
      </div>

      {error && <p className="text-sm font-medium text-ink">{error}</p>}
      <p className="text-xs text-gray-400">1 credit = 1 voice call. Credits never expire.</p>
    </section>
  );
}
