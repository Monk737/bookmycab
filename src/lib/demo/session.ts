// src/lib/demo/session.ts
import "server-only";
import { NextResponse } from "next/server";
import type { Claims } from "@/middleware/access";

/** Returns true when the current session is a read-only demo session. */
export function isDemoUser(claims: Claims | null): boolean {
  return claims?.is_demo === true;
}

/**
 * Returns a 403 NextResponse when the session is a demo, null otherwise.
 * Call this at the top of any mutating route handler or server action.
 */
export function blockIfDemo(claims: Claims | null): NextResponse | null {
  if (!isDemoUser(claims)) return null;
  return NextResponse.json({ error: "Read-only in demo mode." }, { status: 403 });
}
