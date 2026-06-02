// src/app/demo/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

/**
 * GET /demo — one-click read-only demo session.
 *
 * Signs in the shared demo user (demo@demo.cabbybot.com) via
 * signInWithPassword. The Supabase SSR client writes the session cookie
 * automatically. Redirects to /dashboard on success, /login on failure.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!env.DEMO_TENANT_ID) {
    console.warn("/demo: DEMO_TENANT_ID not configured — redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: "demo@demo.cabbybot.com",
    password: env.DEMO_SESSION_SECRET,
  });

  if (error) {
    console.error("/demo: signInWithPassword failed:", error.message);
    return NextResponse.redirect(new URL("/login?demo_error=1", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
