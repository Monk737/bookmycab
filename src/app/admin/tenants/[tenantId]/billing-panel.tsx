"use client";

import { useTransition } from "react";
import { startNewModelBilling, syncSubscription } from "./billing-actions";

interface BillingPanelProps {
  tenantId: string;
  /** Commercial model: "chat" | "voice" | "double_decker" (null = not yet set). */
  commercialModel: string | null;
  /** Tenant lifecycle status; billing is only startable while "onboarding". */
  status: string;
}

/**
 * Stripe billing controls for a tenant. A single "Start billing" action
 * provisions the one-time setup invoice plus a rolling-monthly GBP subscription
 * per product (chat and/or voice), then "Sync from Stripe" reconciles state.
 */
export function BillingPanel({ tenantId, commercialModel, status }: BillingPanelProps) {
  const [pending, start] = useTransition();

  const billingActive = status === "active";
  // Start billing only acts while onboarding (the action no-ops otherwise);
  // mirror that in the UI so the control isn't enabled for active / suspended
  // / churned tenants, or before a commercial model is chosen.
  const canStart = status === "onboarding" && !!commercialModel;
  const startLabel = billingActive ? "Billing active" : "Start billing";

  return (
    <section className="border-[3px] border-ink bg-paper p-5">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
        Stripe billing
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !canStart}
          onClick={() => start(() => void startNewModelBilling(tenantId))}
          className="border-2 border-ink bg-brut-lime px-4 py-2 text-sm font-bold uppercase text-ink hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startLabel}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void syncSubscription(tenantId))}
          className="border-[3px] border-ink px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sync from Stripe
        </button>
      </div>
      {!commercialModel && (
        <p className="mt-2 text-xs text-gray-500">
          Set this tenant&apos;s product (Chat, AI Voice, or Double Decker) before starting billing.
        </p>
      )}
    </section>
  );
}
