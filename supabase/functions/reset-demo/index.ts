// supabase/functions/reset-demo/index.ts
// Deno Edge Function — clears demo tenant time-series data on a 24h schedule.
//
// Schedule in Supabase dashboard: Functions → reset-demo → Schedule → "0 3 * * *"
// Or in supabase/config.toml (Supabase CLI ≥ 1.170):
//   [functions.reset-demo]
//   schedule = "0 3 * * *"
//
// After clearing, re-seed with: npx tsx scripts/seed-demo.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEMO_TENANT_ID = Deno.env.get("DEMO_TENANT_ID") ?? "d0000000-0000-0000-0000-000000000001";

const BOOKING_AUTO_IDS = [
  "d0000000-0000-0000-0000-000000000010",
  "d0000000-0000-0000-0000-000000000011",
  "d0000000-0000-0000-0000-000000000012",
];

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Clear bookings first (FK constraint: bookings reference conversations).
    const { error: bErr } = await sb.from("bookings").delete().in("automation_id", BOOKING_AUTO_IDS);
    if (bErr) throw new Error(`bookings delete: ${bErr.message}`);

    // 2. Get conversation IDs before deleting messages.
    const { data: convRows, error: convFetchErr } = await sb
      .from("conversations")
      .select("id")
      .in("automation_id", BOOKING_AUTO_IDS);
    if (convFetchErr) throw new Error(`conversations fetch: ${convFetchErr.message}`);

    if (convRows && convRows.length > 0) {
      const convIds = (convRows as { id: string }[]).map((r) => r.id);
      // Batch deletes to avoid URL length limits.
      for (let i = 0; i < convIds.length; i += 200) {
        const { error: mErr } = await sb
          .from("messages")
          .delete()
          .in("conversation_id", convIds.slice(i, i + 200));
        if (mErr) throw new Error(`messages delete batch ${i}: ${mErr.message}`);
      }
    }

    // 3. Delete conversations.
    const { error: cErr } = await sb.from("conversations").delete().in("automation_id", BOOKING_AUTO_IDS);
    if (cErr) throw new Error(`conversations delete: ${cErr.message}`);

    // 4. Delete automation runs.
    const { error: rErr } = await sb.from("automation_runs").delete().in("automation_id", BOOKING_AUTO_IDS);
    if (rErr) throw new Error(`automation_runs delete: ${rErr.message}`);

    // 5. Touch tenant updated_at so callers can see the last-reset timestamp.
    await sb.from("tenants").update({ updated_at: new Date().toISOString() }).eq("id", DEMO_TENANT_ID);

    const summary = {
      ok: true,
      cleared_at: new Date().toISOString(),
      tenant: DEMO_TENANT_ID,
      automations: BOOKING_AUTO_IDS,
      note: "Re-seed with: npx tsx scripts/seed-demo.ts",
    };

    console.log(`[reset-demo] ${JSON.stringify(summary)}`);
    return new Response(JSON.stringify(summary), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reset-demo] failed:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
