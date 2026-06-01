"use client";

import { useActionState, useId } from "react";
import {
  editContract,
  sendInvite,
  suspendTenant,
  reinstateTenant,
  markChurned,
  type ActionState,
} from "./actions";

const initialState: ActionState = { fieldErrors: {}, formError: null };

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40";

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-600">
      {error}
    </p>
  );
}

/**
 * Edit-contract form. Posts to `editContract` bound to this tenant. Date inputs
 * default to the current values; monthly price + renewal mode are editable.
 */
export function EditContractForm({
  tenantId,
  contractStart,
  contractRenewal,
  monthlyPrice,
  renewalMode,
}: {
  tenantId: string;
  contractStart: string | null;
  contractRenewal: string | null;
  monthlyPrice: string | null;
  renewalMode: string;
}) {
  const action = editContract.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const startId = useId();
  const renewalId = useId();
  const priceId = useId();
  const modeId = useId();
  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.formError}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          Contract updated.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={startId} className="text-sm font-medium text-zinc-700">
            Contract start
          </label>
          <input
            id={startId}
            name="contract_start"
            type="date"
            defaultValue={contractStart ?? ""}
            className={inputClass}
          />
          <FieldError id={`${startId}-error`} error={fe.contract_start?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={renewalId} className="text-sm font-medium text-zinc-700">
            Contract renewal
          </label>
          <input
            id={renewalId}
            name="contract_renewal"
            type="date"
            defaultValue={contractRenewal ?? ""}
            className={inputClass}
          />
          <FieldError id={`${renewalId}-error`} error={fe.contract_renewal?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={priceId} className="text-sm font-medium text-zinc-700">
            Monthly price
          </label>
          <input
            id={priceId}
            name="monthly_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={monthlyPrice ?? ""}
            placeholder="0"
            className={inputClass}
          />
          <FieldError id={`${priceId}-error`} error={fe.monthly_price?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={modeId} className="text-sm font-medium text-zinc-700">
            Renewal mode
          </label>
          <select
            id={modeId}
            name="renewal_mode"
            defaultValue={renewalMode}
            className={inputClass}
          >
            <option value="rolling_monthly">Rolling monthly</option>
            <option value="auto_12mo">Auto 12-month</option>
          </select>
          <FieldError id={`${modeId}-error`} error={fe.renewal_mode?.[0]} />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save contract"}
        </button>
      </div>
    </form>
  );
}

/**
 * Send-invite form. Email defaults to the tenant's contact email; role is one of
 * Owner/Admin/Viewer. Posts to `sendInvite` bound to this tenant.
 */
export function InviteForm({
  tenantId,
  defaultEmail,
}: {
  tenantId: string;
  defaultEmail: string | null;
}) {
  const action = sendInvite.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const emailId = useId();
  const roleId = useId();
  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state.formError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.formError}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          Invite sent.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            defaultValue={defaultEmail ?? ""}
            placeholder="owner@speedycabs.co.uk"
            aria-invalid={fe.email ? true : undefined}
            className={`${inputClass} ${fe.email ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/40" : ""}`}
          />
          <FieldError id={`${emailId}-error`} error={fe.email?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={roleId} className="text-sm font-medium text-zinc-700">
            Role
          </label>
          <select
            id={roleId}
            name="role"
            defaultValue="Owner"
            className={inputClass}
          >
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
            <option value="Viewer">Viewer</option>
          </select>
          <FieldError id={`${roleId}-error`} error={fe.role?.[0]} />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}

const lifecycleBtn =
  "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2";

/**
 * Lifecycle controls: suspend / reinstate / mark churned. Each is a single-button
 * form posting to its bound action. The available controls depend on the current
 * status so the staff member only sees valid transitions.
 */
export function LifecycleControls({
  tenantId,
  status,
}: {
  tenantId: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {status !== "suspended" && status !== "churned" && (
        <form action={suspendTenant.bind(null, tenantId)}>
          <button
            type="submit"
            className={`${lifecycleBtn} border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-500`}
          >
            Suspend
          </button>
        </form>
      )}
      {status === "suspended" && (
        <form action={reinstateTenant.bind(null, tenantId)}>
          <button
            type="submit"
            className={`${lifecycleBtn} border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500`}
          >
            Reinstate
          </button>
        </form>
      )}
      {status !== "churned" && (
        <form action={markChurned.bind(null, tenantId)}>
          <button
            type="submit"
            className={`${lifecycleBtn} border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 focus-visible:ring-zinc-500`}
          >
            Mark churned
          </button>
        </form>
      )}
    </div>
  );
}
