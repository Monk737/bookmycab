"use client";

import { useTransition } from "react";
import { issueActivationInvoice, syncSubscription } from "./billing-actions";

interface BillingPanelProps {
  tenantId: string;
  /** Commercial model: "chat" | "voice" | "custom" (null = not yet set). */
  commercialModel: string | null;
  /** Tenant lifecycle status; the invoice is issuable only while "onboarding". */
  status: string;
  /** The Stripe hosted-invoice pay link, once an activation invoice exists. */
  invoiceUrl?: string | null;
}

/**
 * Stripe billing controls for a tenant. "Issue / re-send invoice" creates the
 * activation invoice (setup fee + first period) — a subscription per product for
 * recurring plans, or a one-off invoice for one-time packs — and emails the
 * tenant the pay link. Idempotent, so it doubles as a re-send. "Sync from
 * Stripe" reconciles state.
 */
export function BillingPanel({ tenantId, commercialModel, status, invoiceUrl }: BillingPanelProps) {
  const [pending, start] = useTransition();

  const billingActive = status === "active";
  // The action only acts while onboarding (it no-ops otherwise); mirror that in
  // the UI so the control isn't enabled for active / suspended / churned
  // tenants, or before a commercial model is chosen.
  const canIssue = status === "onboarding" && !!commercialModel;
  const issueLabel = billingActive ? "Billing active" : "Issue / re-send invoice";

  return (
    <section className="border-[3px] border-ink bg-paper p-5">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
        Stripe billing
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !canIssue}
          onClick={() => start(() => void issueActivationInvoice(tenantId))}
          className="border-2 border-ink bg-brut-lime px-4 py-2 text-sm font-bold uppercase text-ink hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {issueLabel}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void syncSubscription(tenantId))}
          className="border-[3px] border-ink px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sync from Stripe
        </button>

        {invoiceUrl && (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-[3px] border-ink px-4 py-2 text-sm font-medium text-ink underline underline-offset-2 hover:bg-gray-50"
          >
            View invoice
          </a>
        )}
      </div>
      {!commercialModel && (
        <p className="mt-2 text-xs text-gray-500">
          Set this tenant&apos;s plan (WhatsApp Suite, AI Voice, or Custom) before issuing the invoice.
        </p>
      )}
    </section>
  );
}
