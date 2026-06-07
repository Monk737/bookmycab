// src/app/demo/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

/**
 * GET /demo, one-click read-only demo session.
 *
 * Signs in the shared demo user (demo@demo.bookmycab.com) via
 * signInWithPassword. The Supabase SSR client writes the session cookie
 * automatically. Redirects to /dashboard on success.
 *
 * When the demo can't be opened (not provisioned, or sign-in fails) we send
 * the visitor to the contact page with a friendly explanation, NOT to a login
 * wall they have no account for.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const unavailable = new URL("/contact?demo=unavailable", request.url);

  if (!env.DEMO_TENANT_ID) {
    console.warn("/demo: DEMO_TENANT_ID not configured");
    return NextResponse.redirect(unavailable);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: "demo@demo.bookmycab.com",
    password: env.DEMO_SESSION_SECRET,
  });

  if (error) {
    console.error("/demo: signInWithPassword failed:", error.message);
    return NextResponse.redirect(unavailable);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
