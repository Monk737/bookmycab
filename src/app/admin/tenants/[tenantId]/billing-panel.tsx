"use client";

import { useTransition } from "react";
import {
  createSetupFeeInvoice,
  startSubscription,
  syncSubscription,
} from "./billing-actions";

interface BillingPanelProps {
  tenantId: string;
  planBand: string;
  setupFeePaid: boolean;
  hasSubscription: boolean;
}

export function BillingPanel({ tenantId, planBand, setupFeePaid, hasSubscription }: BillingPanelProps) {
  const [pending, start] = useTransition();
  const isCustom = planBand === "Custom";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Stripe billing
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || setupFeePaid}
          onClick={() => start(() => void createSetupFeeInvoice(tenantId))}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {setupFeePaid ? "Setup fee paid" : "Create setup-fee invoice"}
        </button>

        <button
          type="button"
          disabled={pending || hasSubscription || isCustom}
          title={isCustom ? "Custom band has no fixed price — configure in Stripe" : undefined}
          onClick={() => start(() => void startSubscription(tenantId))}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasSubscription ? "Subscription active" : "Start subscription (go-live)"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void syncSubscription(tenantId))}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sync from Stripe
        </button>
      </div>
      {isCustom && (
        <p className="mt-2 text-xs text-zinc-500">
          Custom-band subscriptions are quoted and configured directly in Stripe.
        </p>
      )}
    </section>
  );
}
