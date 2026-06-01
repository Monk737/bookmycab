"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { requestReset, type RequestResetState } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: RequestResetState = {
  fieldErrors: {},
  formError: null,
  successMessage: null,
};

/**
 * Forgot-password form — client component.
 * On success renders a neutral confirmation message to avoid account enumeration.
 */
export function ForgotForm() {
  const emailId = useId();
  const [state, formAction] = useActionState(requestReset, initialState);

  const emailError = state.fieldErrors["email"]?.[0] ?? null;

  return (
    <AuthCard heading="Reset your password" error={state.formError}>
      {state.successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {state.successMessage}
        </div>
      ) : (
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          <Field
            id={emailId}
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            error={emailError}
            required
          />

          <SubmitButton label="Send reset link" pendingLabel="Sending…" />
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        <Link
          href="/login"
          className="text-indigo-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded"
        >
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
