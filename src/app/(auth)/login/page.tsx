import { redirect } from "next/navigation";
import { getCurrentClaims, redirectTargetFor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

/**
 * Login page — server component.
 * If the user is already authenticated, redirect them to their role target
 * immediately (the middleware will handle MFA gating on the next request).
 */
export default async function LoginPage() {
  const claims = await getCurrentClaims();
  if (claims) {
    redirect(redirectTargetFor(claims));
  }

  return <LoginForm />;
}
