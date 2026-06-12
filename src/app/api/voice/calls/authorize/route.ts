import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseAuthorizeBody, decideCallAuthorization } from "@/lib/voice/authorize";
import { periodBounds } from "@/lib/entitlements/meter";

export const runtime = "nodejs";

/**
 * Pre-call credit gate for AI Voice. The tenant's n8n workflow calls this
 * before letting the Vapi agent use tools (and the Vapi phone number's
 * assistant-request hook calls it before the call is even answered). Returns
 * whether the NEXT call is payable from the plan pool or top-up credit.
 *
 * Read-only — consumption is still recorded exclusively by record_voice_call
 * at end of call, so the gate can never double-charge or drift from the meter.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const parsed = parseAuthorizeBody(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const { tenant_id } = parsed.data;

  const db = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { start } = periodBounds("month", new Date());

  const [sub, counter, balance] = await Promise.all([
    db
      .from("voice_subscriptions")
      .select("status, monthly_call_allowance")
      .eq("tenant_id", tenant_id)
      .maybeSingle(),
    db
      .from("usage_counters")
      .select("used")
      .eq("tenant_id", tenant_id)
      .eq("feature_key", "voice_calls")
      .eq("period_start", start)
      .maybeSingle(),
    // service_credit_balance: unfiltered ledger sum (the session-scoped
    // credit_balance RPC returns 0 under the service-role key — no user JWT).
    db.rpc("service_credit_balance", { p_tenant: tenant_id }),
  ]);

  if (sub.error || counter.error || balance.error) {
    console.error("voice authorize lookup failed", sub.error ?? counter.error ?? balance.error);
    return NextResponse.json({ error: "Could not evaluate the call gate." }, { status: 500 });
  }

  const decision = decideCallAuthorization({
    planStatus: (sub.data?.status as string | null) ?? null,
    allowance: Number(sub.data?.monthly_call_allowance ?? 0),
    used: Number(counter.data?.used ?? 0),
    creditBalance: typeof balance.data === "number" ? balance.data : Number(balance.data ?? 0),
  });

  return NextResponse.json(decision, { status: 200 });
}
