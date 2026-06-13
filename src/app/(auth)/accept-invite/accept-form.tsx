"use client";

import { useEffect, useId, useState } from "react";
import { finalizeInviteAcceptance } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { createClient } from "@/lib/supabase/browser";

type SessionState = "loading" | "valid" | "invalid";

/**
 * Accept-invite form (client). The invite session arrives in the URL hash, which
 * only the browser can read, so the password is set CLIENT-SIDE here via the
 * browser Supabase client (which holds the invite session). This also means the
 * update always targets the invited user, never a pre-existing cookie session
 * (e.g. a logged-in admin). After the password is set we mark acceptance via a
 * token-authenticated server action, then navigate to the dashboard.
 */
export function AcceptForm() {
  const fullNameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        setSessionState((s) => (s === "loading" ? "valid" : s));
      } else if (event === "SIGNED_OUT") {
        setSessionState((s) => (s === "loading" ? "invalid" : s));
      }
    });
    // Fallback in case the auth event fired before the listener attached.
    supabase.auth.getSession().then(({ data }) => {
      setSessionState((s) => (s === "loading" ? (data.session ? "valid" : "invalid") : s));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = e.currentTarget;
    const fullName = (form.elements.namedItem("fullName") as HTMLInputElement)?.value.trim() ?? "";
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value ?? "";
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement)?.value ?? "";

    const errs: Record<string, string> = {};
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (password !== confirm) errs.confirmPassword = "Passwords do not match.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
      ...(fullName ? { data: { full_name: fullName } } : {}),
    });
    if (error) {
      setSubmitting(false);
      setFormError("Could not set your password. Your invite link may have expired, please reopen it from your email.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        await finalizeInviteAcceptance(session.access_token, fullName || undefined);
      } catch {
        // best-effort: the password is set; acceptance marking is non-blocking
      }
    }
    // Hard navigation so the freshly-written session cookies are used.
    window.location.assign("/dashboard");
  }

  if (sessionState === "loading") {
    return (
      <AuthCard heading="Accept invitation" error={null}>
        <p className="text-sm text-gray-600 text-center">Verifying your invite link&hellip;</p>
      </AuthCard>
    );
  }

  if (sessionState === "invalid") {
    return (
      <AuthCard heading="Invitation invalid or expired" error={null}>
        <p className="mb-4 text-sm text-gray-700 text-center">
          This invitation link is invalid or has expired. Open it in a private/incognito window
          straight from your email, or contact your administrator for a fresh invite.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard heading="Accept invitation" error={formError}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Set up your account to get started. Choose a strong password with at least 8 characters.
        </p>

        <Field id={fullNameId} name="fullName" label="Full name" type="text" autoComplete="name" placeholder="Jane Smith" error={fieldErrors.fullName ?? null} />
        <Field id={passwordId} name="password" label="Password" type="password" autoComplete="new-password" placeholder="••••••••" error={fieldErrors.password ?? null} required />
        <Field id={confirmPasswordId} name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" error={fieldErrors.confirmPassword ?? null} required />

        <button
          type="submit"
          disabled={submitting}
          className="brut-press brut-focus inline-flex h-11 items-center justify-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Setting up…" : "Set up account"}
        </button>
      </form>
    </AuthCard>
  );
}
