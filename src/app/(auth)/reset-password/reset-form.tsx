"use client";

import { useActionState, useId, useEffect, useState } from "react";
import { updatePassword, type AuthState } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { ButtonLink } from "@/components/auth/button-link";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/browser";

type SessionState = "loading" | "valid" | "invalid";

const initialState: AuthState = { fieldErrors: {}, formError: null };

/**
 * Reset-password form — client component.
 * Checks for a RECOVERY session specifically on mount using onAuthStateChange.
 *
 * Detection method: onAuthStateChange + PASSWORD_RECOVERY event.
 * Why: @supabase/supabase-js@2.106.2 does NOT expose a `type` field on the
 * Session object itself. The only reliable way to detect a recovery session
 * (vs. a normal logged-in session) is to listen for the PASSWORD_RECOVERY
 * AuthChangeEvent, which GoTrue fires when it exchanges a recovery code for
 * a session. A plain logged-in user hitting this page would fire SIGNED_IN
 * instead and be correctly rejected.
 */
export function ResetForm() {
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [state, formAction] = useActionState(updatePassword, initialState);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionState("valid");
      } else {
        // Any other event (SIGNED_IN, SIGNED_OUT, etc.) on this page means
        // the user did not arrive via a valid recovery link.
        setSessionState("invalid");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
        <ButtonLink href="/forgot-password">
          Request a new reset link
        </ButtonLink>
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
