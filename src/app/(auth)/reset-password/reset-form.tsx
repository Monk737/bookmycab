"use client";

import { useActionState, useId, useEffect, useState } from "react";
import Link from "next/link";
import { updatePassword, type AuthState } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/browser";

type SessionState = "loading" | "valid" | "invalid";

const initialState: AuthState = { fieldErrors: {}, formError: null };

/**
 * Reset-password form — client component.
 * Checks for a valid Supabase recovery session on mount.
 * If no session is present, renders an "invalid or expired link" state.
 */
export function ResetForm() {
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [state, formAction] = useActionState(updatePassword, initialState);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      // A recovery session has session.user present; an unauthenticated visit does not.
      if (data.session?.user) {
        setSessionState("valid");
      } else {
        setSessionState("invalid");
      }
    });
  }, []);

  const passwordError = state.fieldErrors["password"]?.[0] ?? null;
  const confirmPasswordError = state.fieldErrors["confirmPassword"]?.[0] ?? null;

  if (sessionState === "loading") {
    return (
      <AuthCard heading="Set new password" error={null}>
        <p className="text-sm text-slate-500 text-center">Verifying your reset link&hellip;</p>
      </AuthCard>
    );
  }

  if (sessionState === "invalid") {
    return (
      <AuthCard heading="Link invalid or expired" error={null}>
        <p className="mb-4 text-sm text-slate-600 text-center">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white text-center bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 cursor-pointer"
        >
          Request a new reset link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard heading="Set new password" error={state.formError}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">
          Choose a strong password with at least 8 characters.
        </p>

        <Field
          id={passwordId}
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={passwordError}
          required
        />

        <Field
          id={confirmPasswordId}
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={confirmPasswordError}
          required
        />

        <SubmitButton label="Set new password" pendingLabel="Saving…" />
      </form>
    </AuthCard>
  );
}
