"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createCoupon, type CouponFormState } from "./actions";

const initialState: CouponFormState = { fieldErrors: {}, formError: null };

const inputClass =
  "border-[3px] border-ink bg-paper px-3 py-2 text-sm text-ink placeholder:text-gray-400 outline-none transition-colors hover:border-gray-400 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink";

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-brut-red-deep">
      {error}
    </p>
  );
}

/** Inline form to mint a new coupon. Resets on success. */
export function CouponForm() {
  const [state, action, pending] = useActionState(createCoupon, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const codeId = useId();
  const pctId = useId();
  const appliesId = useId();
  const maxId = useId();
  const expId = useId();
  const descId = useId();

  // Clear the form after a successful create.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const fe = state.fieldErrors;

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="flex flex-col gap-4 border-[3px] border-ink bg-paper p-5"
    >
      <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">
        New coupon
      </h2>

      {state.formError && (
        <p role="alert" className="border border-ink bg-brut-red/15 px-3 py-2 text-sm text-brut-red-deep">
          {state.formError}
        </p>
      )}
      {state.ok && (
        <p role="status" className="border border-ink bg-brut-lime/30 px-3 py-2 text-sm text-ink">
          Coupon created.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={codeId} className="text-sm font-medium text-gray-700">Code</label>
          <input id={codeId} name="code" required placeholder="LAUNCH100" autoCapitalize="characters"
            aria-invalid={fe.code ? true : undefined} className={inputClass} />
          <FieldError id={codeId} error={fe.code?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={pctId} className="text-sm font-medium text-gray-700">Percent off</label>
          <input id={pctId} name="percent_off" type="number" min="1" max="100" step="1" required placeholder="100"
            aria-invalid={fe.percent_off ? true : undefined} className={inputClass} />
          <p className="text-xs text-gray-500">100 = fully comped, bypasses Stripe.</p>
          <FieldError id={pctId} error={fe.percent_off?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={appliesId} className="text-sm font-medium text-gray-700">Applies to</label>
          <select id={appliesId} name="applies_to" defaultValue="both" className={inputClass}>
            <option value="both">Setup fee + subscription</option>
            <option value="setup">Setup fee only</option>
            <option value="subscription">Subscription only</option>
          </select>
          <FieldError id={appliesId} error={fe.applies_to?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={maxId} className="text-sm font-medium text-gray-700">Max redemptions</label>
          <input id={maxId} name="max_redemptions" type="number" min="1" step="1" placeholder="Blank = unlimited"
            aria-invalid={fe.max_redemptions ? true : undefined} className={inputClass} />
          <FieldError id={maxId} error={fe.max_redemptions?.[0]} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={expId} className="text-sm font-medium text-gray-700">Expires</label>
          <input id={expId} name="expires_at" type="date" className={inputClass} />
          <p className="text-xs text-gray-500">Optional. Valid through end of day.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={descId} className="text-sm font-medium text-gray-700">Description</label>
          <input id={descId} name="description" placeholder="Optional note" className={inputClass} />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer bg-brut-lime px-4 py-2 text-sm font-medium text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create coupon"}
        </button>
      </div>
    </form>
  );
}
