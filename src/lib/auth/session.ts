import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseClaims, type Claims } from "@/middleware/access";

/** Returns the currently authenticated Supabase user, or null if not signed in. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Returns the parsed Claims for the current session, or null if unauthenticated. */
export async function getCurrentClaims(): Promise<Claims | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const raw = data?.claims as Record<string, unknown> | undefined;
  if (!raw) return null;
  return parseClaims(raw);
}

/**
 * Pure helper: given claims, returns the appropriate post-login redirect target.
 * Staff land on /admin; everyone else lands on /dashboard.
 */
export function redirectTargetFor(claims: Claims): string {
  return claims.is_flowmo_staff ? "/admin" : "/dashboard";
}

/**
 * Server-component / Server-action guard.
 * Returns the current claims, or calls next/navigation redirect("/login") if unauthenticated.
 */
export async function requireUser(): Promise<Claims> {
  const claims = await getCurrentClaims();
  if (!claims) redirect("/login");
  return claims;
}
