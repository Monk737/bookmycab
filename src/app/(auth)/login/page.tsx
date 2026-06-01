import { redirect } from "next/navigation";
import { getCurrentClaims, redirectTargetFor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — CabbyBot",
  robots: { index: false },
};

/**
 * Login page — server component.
 * If the user is already authenticated, redirect them to their role target
 * immediately (the middleware will handle MFA gating on the next request).
 *
 * Accepts `?error=session_error` (set by the MFA page when listFactors fails)
 * and surfaces a notice via LoginForm.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const claims = await getCurrentClaims();
  if (claims) {
    redirect(redirectTargetFor(claims));
  }

  const { error } = await searchParams;
  const notice =
    error === "session_error"
      ? "Your session expired. Please sign in again."
      : undefined;

  return <LoginForm notice={notice} />;
}
