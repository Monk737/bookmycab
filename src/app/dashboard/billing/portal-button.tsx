"use client";

import { useState } from "react";

interface PortalButtonProps {
  orgId: string;
}

export function PortalButton({ orgId }: PortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/portal`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setMessage(
          json.error
            ? "Billing portal is being set up — your CabbyBot contact can help in the meantime."
            : "Something went wrong. Please contact your CabbyBot contact.",
        );
      } else {
        const json = (await res.json()) as { url?: string };
        if (json.url) {
          window.location.href = json.url;
        } else {
          setMessage("Billing portal is being set up — your CabbyBot contact can help in the meantime.");
        }
      }
    } catch {
      setMessage("Something went wrong. Please contact your CabbyBot contact.");
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
        className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {loading ? "Loading..." : "Update Payment Method"}
      </button>
      {message && (
        <p className="text-sm text-slate-600 max-w-sm">{message}</p>
      )}
    </div>
  );
}
