import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { evaluateAccess, type Claims } from "@/middleware/access";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Refreshes the session cookie and returns verified claims.
  const { data } = await supabase.auth.getClaims();
  const raw = data?.claims as Record<string, unknown> | undefined;

  const claims: Claims | null = raw
    ? {
        sub: String(raw.sub),
        tenant_id: (raw.tenant_id as string) ?? null,
        role: (raw.role as Claims["role"]) ?? null,
        is_flowmo_staff: Boolean(raw.is_flowmo_staff),
      }
    : null;

  const decision = evaluateAccess(request.nextUrl.pathname, claims);

  if (decision.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    return NextResponse.redirect(url);
  }
  if (decision.kind === "forbidden") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return response;
}

export const config = {
  // Run on everything except static assets; logic above whitelists public paths.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
