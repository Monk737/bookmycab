"use client";

import { useState } from "react";

/**
 * Starts the autopay payment-method setup. POSTs to the autopay route, which
 * returns a Stripe Checkout (mode: setup) URL to capture a card; on completion
 * the saved card becomes the default for monthly subscription renewals.
 */
export function AutopayButton({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/autopay`, { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(json.error ?? "Could not start payment setup. Please try again or contact your BookMyCab contact.");
    } catch {
      setMessage("Something went wrong. Please try again or contact your BookMyCab contact.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="brut-press inline-flex h-11 items-center justify-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loading…" : "Set up autopay"}
      </button>
      {message && <p className="max-w-sm text-sm text-gray-600">{message}</p>}
    </div>
  );
}
