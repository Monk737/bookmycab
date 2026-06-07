import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClaims, redirectTargetFor } from "@/lib/auth/session";
import { MfaEnroll } from "./mfa-enroll";
import { MfaChallenge } from "./mfa-challenge";

export const metadata = {
  title: "Two-factor authentication, BookMyCab",
  robots: { index: false },
};

/**
 * MFA page, server component.
 *
 * Routing logic:
 *  1. No authenticated user → redirect to /login.
 *  2. Already aal2 → redirect to the role-appropriate target (avoid re-entry).
 *  3. Verified TOTP factor exists but session is aal1 → challenge flow.
 *  4. No verified TOTP factor → enroll flow.
 */
export default async function MfaPage() {
  const claims = await getCurrentClaims();

  // 1. Unauthenticated.
  if (!claims) redirect("/login");

  // 2. Already at aal2, nothing to do.
  if (claims.aal === "aal2") redirect(redirectTargetFor(claims));

  const supabase = await createClient();
  const { data: factorsData, error: listError } =
    await supabase.auth.mfa.listFactors();

  // If listFactors fails transiently, redirect rather than silently misrouting.
  if (listError) redirect("/login?error=session_error");

  // Verified TOTP factors are returned in data.totp (Factor<'totp', 'verified'>[]).
  const verifiedTotpFactors = factorsData?.totp ?? [];
  const redirectTarget = redirectTargetFor(claims);

  // 3. Verified factor exists → challenge.
  const verifiedFactor = verifiedTotpFactors[0];
  if (verifiedFactor) {
    return (
      <MfaChallenge
        factorId={verifiedFactor.id}
        redirectTarget={redirectTarget}
      />
    );
  }

  // 4. No verified factor → enroll.
  return <MfaEnroll redirectTarget={redirectTarget} />;
}
