"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentClaims, redirectTargetFor } from "@/lib/auth/session";
import { env } from "@/env";

// ---------------------------------------------------------------------------
// Shared form-state shape
// ---------------------------------------------------------------------------

export type AuthState = {
  /** Field-level errors keyed by field name. */
  fieldErrors: Record<string, string[]>;
  /** Top-level (non-field) error message, e.g. from the auth provider. */
  formError: string | null;
};

const initialState: AuthState = { fieldErrors: {}, formError: null };

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

// ---------------------------------------------------------------------------
// recordLogin — updates last_login_at for the signed-in user.
//
// Design note: public.users has RLS enabled but no UPDATE policy is defined
// for authenticated users. Rather than rely on RLS behaviour that could block
// the update silently, we use the service-role client which bypasses RLS.
// This matches the pattern used elsewhere in the project for privileged writes
// (e.g. audit_log). The service-role client is confined to this single call.
// ---------------------------------------------------------------------------

async function recordLogin(userId: string): Promise<void> {
  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { error } = await serviceClient
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("recordLogin failed", error);
  }
}

// ---------------------------------------------------------------------------
// signIn server action
// ---------------------------------------------------------------------------

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // 1. Validate inputs with zod.
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const { email, password } = parsed.data;

  // 2. Authenticate with Supabase.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return {
      ...initialState,
      formError: "Invalid email or password. Please try again.",
    };
  }

  // 3. Record login timestamp (service-role; see note above).
  await recordLogin(data.user.id);

  // 4. Read claims and redirect to the appropriate target.
  //    The middleware handles the MFA gate on the next request.
  const claims = await getCurrentClaims();
  if (!claims) {
    console.warn("signIn: getCurrentClaims() returned null after successful sign-in — falling back to /dashboard. Check custom access token hook.");
  }
  const target = claims ? redirectTargetFor(claims) : "/dashboard";

  redirect(target);
}

// ---------------------------------------------------------------------------
// signOut server action
// ---------------------------------------------------------------------------

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
