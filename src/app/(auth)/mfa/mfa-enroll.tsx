"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";

type Props = {
  /** Post-aal2 redirect target, computed server-side. */
  redirectTarget?: string;
};

type EnrollState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      factorId: string;
      qrCode: string;
      secret: string;
    };

/**
 * MFA enroll component — client component.
 *
 * 1. On mount, calls supabase.auth.mfa.enroll({ factorType: "totp" }) to obtain
 *    a QR code and secret.
 * 2. User scans the QR (or enters the secret) in their authenticator app.
 * 3. User submits the 6-digit code; we challengeAndVerify to confirm.
 * 4. On success, reload to redirectTarget so middleware re-reads the aal2 session.
 */
export function MfaEnroll({ redirectTarget = "/dashboard" }: Props) {
  const codeId = useId();

  const enrolledRef = useRef(false);

  const [enrollState, setEnrollState] = useState<EnrollState>({ phase: "loading" });
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (enrolledRef.current) return;
    enrolledRef.current = true;

    const supabase = createClient();

    supabase.auth.mfa
      .enroll({ factorType: "totp" })
      .then(({ data, error }) => {
        if (error || !data) {
          setEnrollState({
            phase: "error",
            message: error?.message ?? "Failed to start setup. Please try again.",
          });
          return;
        }

        // data.totp.qr_code is a raw SVG string — prepend the data URI prefix.
        const rawQr = data.totp.qr_code;
        const qrCode = rawQr.startsWith("data:")
          ? rawQr
          : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawQr)}`;

        setEnrollState({
          phase: "ready",
          factorId: data.id,
          qrCode,
          secret: data.totp.secret,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unexpected error. Please refresh.";
        setEnrollState({ phase: "error", message: msg });
      });
    // Run once on mount — enrolling again on re-render would create duplicate factors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enrollState.phase !== "ready") return;

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setVerifyError("Please enter your 6-digit code.");
      return;
    }

    setVerifyError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollState.factorId,
      code: trimmed,
    });

    setSubmitting(false);

    if (error) {
      setVerifyError(error.message ?? "Invalid code. Please try again.");
      return;
    }

    // Full reload so Next.js middleware picks up the new aal2 session.
    window.location.assign(redirectTarget);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (enrollState.phase === "loading") {
    return (
      <AuthCard heading="Set up two-factor authentication" error={null}>
        <p className="text-sm text-slate-500 text-center">
          Preparing your setup&hellip;
        </p>
      </AuthCard>
    );
  }

  // ── Enroll error ─────────────────────────────────────────────────────────
  if (enrollState.phase === "error") {
    return (
      <AuthCard heading="Set up two-factor authentication" error={enrollState.message}>
        <p className="text-sm text-slate-500 text-center">
          Reload the page to try again, or contact your administrator.
        </p>
      </AuthCard>
    );
  }

  // ── Ready — show QR + code entry ─────────────────────────────────────────
  const { qrCode, secret } = enrollState;

  return (
    <AuthCard heading="Set up two-factor authentication" error={null}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-slate-600">
          Scan the QR code with your authenticator app (Google Authenticator,
          Authy, 1Password, etc.), then enter the 6-digit code below to confirm.
        </p>

        {/* QR code — SVG data URI; next/image does not support data: URIs */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCode}
            alt="TOTP QR code — scan with your authenticator app"
            width={160}
            height={160}
            className="rounded-lg border border-slate-200 bg-white p-2"
          />
        </div>

        {/* Manual-entry fallback */}
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer select-none text-xs font-medium text-slate-600">
            Can&apos;t scan the QR code? Enter the secret manually
          </summary>
          <p
            className="mt-2 break-all font-mono text-xs text-slate-700 select-all"
            aria-label="TOTP secret"
          >
            {secret}
          </p>
        </details>

        {/* Verify form */}
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
            error={verifyError}
            required
          />

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={[
              "mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white",
              "bg-indigo-600 transition-colors duration-150",
              "hover:bg-indigo-700 active:bg-indigo-800",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "cursor-pointer",
            ].join(" ")}
          >
            {submitting ? "Verifying…" : "Verify and enable"}
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
