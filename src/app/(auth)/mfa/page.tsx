import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClaims, redirectTargetFor } from "@/lib/auth/session";
import { MfaEnroll } from "./mfa-enroll";
import { MfaChallenge } from "./mfa-challenge";

/**
 * MFA page — server component.
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

  // 2. Already at aal2 — nothing to do.
  if (claims.aal === "aal2") redirect(redirectTargetFor(claims));

  const supabase = await createClient();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();

  // Verified TOTP factors are returned in data.totp (Factor<'totp', 'verified'>[]).
  const verifiedTotpFactors = factorsData?.totp ?? [];
  const redirectTarget = redirectTargetFor(claims);

  // 3. Verified factor exists → challenge.
  if (verifiedTotpFactors.length > 0) {
    return (
      <MfaChallenge
        factorId={verifiedTotpFactors[0].id}
        redirectTarget={redirectTarget}
      />
    );
  }

  // 4. No verified factor → enroll.
  return <MfaEnroll redirectTarget={redirectTarget} />;
}
