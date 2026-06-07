"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";

type Props = {
  /** ID of the verified TOTP factor to challenge. */
  factorId: string;
  /** Post-aal2 redirect target, computed server-side. */
  redirectTarget?: string;
};

/**
 * MFA challenge component, client component.
 *
 * Shown when the user already has a verified TOTP factor. Prompts for their
 * 6-digit code and calls challengeAndVerify to elevate the session to aal2.
 */
export function MfaChallenge({ factorId, redirectTarget = "/dashboard" }: Props) {
  const codeId = useId();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Please enter your 6-digit code.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: trimmed,
    });

    setSubmitting(false);

    if (mfaError) {
      setError(mfaError.message ?? "Invalid code. Please try again.");
      return;
    }

    // Full reload so Next.js middleware picks up the new aal2 session.
    window.location.assign(redirectTarget);
  }

  return (
    <AuthCard heading="Two-factor authentication" error={null}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-700">
          Open your authenticator app and enter the 6-digit code for BookMyCab.
        </p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field
            id={codeId}
            name="code"
            label="6-digit code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            minLength={6}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={[
              "mt-2 w-full brut-press brut-focus border-[3px] border-ink px-4 py-3 text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-brut",
              "bg-brut-yellow transition-colors duration-150",
              "hover:bg-ink hover:text-paper",
              "cursor-pointer",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "cursor-pointer",
            ].join(" ")}
          >
            {submitting ? "Verifying…" : "Verify"}
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
