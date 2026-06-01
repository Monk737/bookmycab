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

// ---------------------------------------------------------------------------
// requestReset server action
// ---------------------------------------------------------------------------

const requestResetSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export type RequestResetState = AuthState & {
  /** Neutral confirmation message shown on success (avoids account enumeration). */
  successMessage: string | null;
};

export async function requestReset(
  _prevState: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const raw = { email: formData.get("email") };

  const parsed = requestResetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
      successMessage: null,
    };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  // Always return a neutral message — never reveal whether the email exists.
  return {
    fieldErrors: {},
    formError: null,
    successMessage: "If that email exists, we've sent a reset link.",
  };
}

// ---------------------------------------------------------------------------
// updatePassword server action
// ---------------------------------------------------------------------------

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// ---------------------------------------------------------------------------
// acceptInvite server action
//
// Design note: after updateUser (password + display name), we use the
// service-role client to mark acceptance in public.tenant_users and optionally
// set the full_name in public.users. The invited user's RLS policies may not
// yet allow self-writes at the point of acceptance (no UPDATE policy is
// defined for authenticated users on either table), so we follow the same
// service-role bypass pattern established by recordLogin above. The
// service-role client is confined to these two targeted updates only.
// ---------------------------------------------------------------------------

const acceptInviteSchema = z
  .object({
    // Empty string from an unfilled input becomes undefined so downstream
    // `if (fullName)` guards are never tripped by a blank submission.
    fullName: z.string().trim().transform((v) => v || undefined).optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function acceptInvite(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const raw = {
    fullName: formData.get("fullName") ?? undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = acceptInviteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const { fullName, password } = parsed.data;
  const supabase = await createClient();

  // 1. Update the user's password (and display name if provided).
  const updatePayload: Parameters<typeof supabase.auth.updateUser>[0] = { password };
  if (fullName) {
    updatePayload.data = { full_name: fullName };
  }

  const { data: updateData, error: updateError } = await supabase.auth.updateUser(updatePayload);

  if (updateError || !updateData.user) {
    return {
      fieldErrors: {},
      formError: "Failed to set up your account. Your invite link may have expired. Please contact your administrator.",
    };
  }

  const userId = updateData.user.id;

  // 2. Mark acceptance via the service-role client (see note above).
  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (fullName) {
    const { error: nameError } = await serviceClient
      .from("users")
      .update({ full_name: fullName })
      .eq("id", userId);

    if (nameError) {
      console.error("acceptInvite: failed to set full_name", nameError);
    }
  }

  const { error: acceptError } = await serviceClient
    .from("tenant_users")
    .update({ accepted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("accepted_at", null);

  if (acceptError) {
    console.error("acceptInvite: failed to set accepted_at", acceptError);
  }

  // 3. Redirect to the appropriate dashboard.
  const claims = await getCurrentClaims();
  if (!claims) {
    console.warn("acceptInvite: getCurrentClaims() returned null after successful acceptance — falling back to /dashboard.");
  }
  const target = claims ? redirectTargetFor(claims) : "/dashboard";

  redirect(target);
}

export async function updatePassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const raw = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = updatePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      fieldErrors: {},
      formError: "Failed to update password. Your reset link may have expired. Please request a new one.",
    };
  }

  redirect("/login?reset=1");
}
