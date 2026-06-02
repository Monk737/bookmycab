"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

type AutomationStatus = "building" | "uat" | "live" | "stopped" | "error";

const DISABLED_STATUSES: AutomationStatus[] = ["building", "uat", "error"];

function DisabledReason({ status }: { status: AutomationStatus }): React.JSX.Element {
  const label =
    status === "building"
      ? "Building…"
      : status === "uat"
      ? "In testing"
      : "Needs attention";
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-150"
    >
      {label}
    </button>
  );
}

export function AutomationControls({
  orgId,
  automationId,
  status,
}: {
  orgId: string;
  automationId: string;
  status: string;
}): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (DISABLED_STATUSES.includes(status as AutomationStatus)) {
    return <DisabledReason status={status as AutomationStatus} />;
  }

  async function doAction(action: "start" | "stop" | "restart") {
    if (action === "stop" || action === "restart") {
      const confirmed = window.confirm(
        action === "stop"
          ? "Stop this automation? It will stop processing new messages."
          : "Restart this automation? It will briefly stop before resuming.",
      );
      if (!confirmed) return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/${action}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg =
          typeof body.error === "string"
            ? body.error
            : `Request failed (${res.status})`;
        setError(msg);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isStopped = status === "stopped";
  const isLive = status === "live";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {isStopped && (
          <button
            type="button"
            onClick={() => doAction("start")}
            disabled={loading}
            className="cursor-pointer rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-all duration-150 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Starting…" : "Start"}
          </button>
        )}
        {isLive && (
          <>
            <button
              type="button"
              onClick={() => doAction("stop")}
              disabled={loading}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Stopping…" : "Stop"}
            </button>
            <button
              type="button"
              onClick={() => doAction("restart")}
              disabled={loading}
              className="cursor-pointer rounded-lg border border-blue-800/30 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition-all duration-150 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Restarting…" : "Restart"}
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
