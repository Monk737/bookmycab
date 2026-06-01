"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState: AuthState = { fieldErrors: {}, formError: null };

/**
 * Login form — client component.
 * Uses `useActionState` to receive server-action state (field/form errors)
 * and surfaces them accessibly via aria-live regions in AuthCard and Field.
 */
export function LoginForm() {
  const emailId = useId();
  const passwordId = useId();

  const [state, formAction] = useActionState(signIn, initialState);

  const emailError = state.fieldErrors["email"]?.[0] ?? null;
  const passwordError = state.fieldErrors["password"]?.[0] ?? null;

  return (
    <AuthCard heading="Sign in to CabbyBot" error={state.formError}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
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

        <Field
          id={passwordId}
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={passwordError}
          required
        />

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-indigo-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton label="Sign in" pendingLabel="Signing in…" />
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Access is invite-only &mdash; contact your CabbyBot administrator.
      </p>
    </AuthCard>
  );
}
