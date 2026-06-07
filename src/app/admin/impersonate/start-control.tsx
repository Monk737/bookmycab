"use client";

import { useActionState, useId, useState } from "react";
import {
  startImpersonation,
  type StartImpersonationState,
} from "./actions";

const initialState: StartImpersonationState = { formError: null };

/**
 * Per-candidate "Impersonate" control. A mandatory reason input gates the start
 * button: the button is disabled until a non-empty reason is entered (the
 * server action and the pure mint also reject an empty reason, defense-in-depth).
 */
export function StartControl({
  tenantId,
  targetUserId,
  label,
}: {
  tenantId: string;
  targetUserId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    startImpersonation,
    initialState,
  );
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const ready = reason.trim().length > 0;

  if (state.ok) {
    return (
      <p
        role="status"
        className="text-xs font-medium text-ink"
      >
        Impersonation started, see the banner. Expires in 15 min.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <label htmlFor={reasonId} className="sr-only">
        Reason to impersonate {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={reasonId}
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          placeholder="Reason (required)"
          aria-invalid={state.formError ? true : undefined}
          className="min-w-0 flex-1 border-[3px] border-ink bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-gray-400 outline-none transition-colors hover:border-gray-400 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink"
        />
        <button
          type="submit"
          disabled={!ready || pending}
          title={ready ? undefined : "Enter a reason to enable"}
          className="shrink-0 cursor-pointer bg-brut-lime px-3 py-1.5 text-sm font-medium text-white outline-none transition-colors hover:bg-brut-lime focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Starting…" : "Impersonate"}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="hidden" name="mode" value="read_only" />
        <input type="checkbox" name="mode" value="write" />
        Allow writes (write-scoped, use only when a fix requires it; fully audited)
      </label>
      {state.formError && (
        <p role="alert" className="text-xs text-brut-red-deep">
          {state.formError}
        </p>
      )}
    </form>
  );
}
