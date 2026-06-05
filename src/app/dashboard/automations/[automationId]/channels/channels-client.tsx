"use client";

import { useState } from "react";

interface ChannelTestButtonProps {
  orgId: string;
  automationId: string;
  channelId: string;
  canManage: boolean;
}

export function ChannelTestButton({
  orgId,
  automationId,
  channelId,
  canManage,
}: ChannelTestButtonProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!canManage) {
    return (
      <span title="Owners/Admins only">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400 cursor-not-allowed select-none"
        >
          Send test message
        </button>
      </span>
    );
  }

  async function handleTest() {
    setLoading(true);
    setResult("idle");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/channels/${channelId}/test`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setResult("success");
    } catch (err) {
      setResult("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleTest}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-800 bg-blue-800 px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
      >
        {loading ? (
          <>
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Sending…
          </>
        ) : (
          "Send test message"
        )}
      </button>

      {result === "success" && (
        <p
          role="status"
          className="text-xs font-medium text-emerald-700"
        >
          Test message queued
        </p>
      )}

      {result === "error" && (
        <p
          role="alert"
          className="text-xs font-medium text-red-600"
        >
          {errorMsg ?? "Test failed — please try again."}
        </p>
      )}
    </div>
  );
}
