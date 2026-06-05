"use client";

import { useActionState, useId, useEffect, useState } from "react";
import { acceptInvite, type AuthState } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/browser";

type SessionState = "loading" | "valid" | "invalid";

const initialState: AuthState = { fieldErrors: {}, formError: null };

/**
 * Accept-invite form — client component.
 * Checks for an active Supabase session on mount using onAuthStateChange.
 *
 * Detection method: onAuthStateChange + SIGNED_IN / INITIAL_SESSION events.
 * Why: Supabase invite links exchange a token for a session and fire SIGNED_IN
 * (or INITIAL_SESSION on page reload) when the exchange completes. This is the
 * canonical signal that the user arrived via a valid invite link. Any other
 * event (SIGNED_OUT, etc.) means the invite link is invalid or expired.
 */
export function AcceptForm() {
  const fullNameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [state, formAction] = useActionState(acceptInvite, initialState);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setSessionState("valid");
      } else {
        // SIGNED_OUT or any unexpected event — treat as invalid/expired invite.
        setSessionState("invalid");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fullNameError = state.fieldErrors["fullName"]?.[0] ?? null;
  const passwordError = state.fieldErrors["password"]?.[0] ?? null;
  const confirmPasswordError = state.fieldErrors["confirmPassword"]?.[0] ?? null;

  if (sessionState === "loading") {
    return (
      <AuthCard heading="Accept invitation" error={null}>
        <p className="text-sm text-slate-500 text-center">Verifying your invite link&hellip;</p>
      </AuthCard>
    );
  }

  if (sessionState === "invalid") {
    return (
      <AuthCard heading="Invitation invalid or expired" error={null}>
        <p className="mb-4 text-sm text-slate-600 text-center">
          This invitation link is invalid or has expired. Please contact your administrator to
          request a new invite.
        </p>
        <p className="text-xs text-slate-500 text-center">
          If you believe this is a mistake, reach out to your BookMyCab administrator.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard heading="Accept invitation" error={state.formError}>
      <form action={formAction} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">
          Set up your account to get started. Choose a strong password with at least 8 characters.
        </p>

        <Field
          id={fullNameId}
          name="fullName"
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          error={fullNameError}
        />

        <Field
          id={passwordId}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={passwordError}
          required
        />

        <Field
          id={confirmPasswordId}
          name="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={confirmPasswordError}
          required
        />

        <SubmitButton label="Set up account" pendingLabel="Setting up…" />
      </form>
    </AuthCard>
  );
}
