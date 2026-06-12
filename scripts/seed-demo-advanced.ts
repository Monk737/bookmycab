#!/usr/bin/env node
/**
 * scripts/seed-demo-advanced.ts
 *
 * Populates mock data for ALL advanced-feature tables (Epics 13–24) on the DEMO
 * tenant so every section of the demo dashboard shows realistic data.
 *
 * Safe to re-run:
 *  - Append-only tables: skip if count > 0 (usage_events, alert_events,
 *    notification_log, dispatch_attempts, report_runs, webhook_deliveries,
 *    copilot_messages)
 *  - All other tables: delete-then-insert
 *  - Column updates (conversations, bookings, tenants): plain UPDATE
 *
 * Usage:
 *   npx tsx scripts/seed-demo-advanced.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_TENANT_ID =
  process.env.DEMO_TENANT_ID ?? "d0000000-0000-0000-0000-000000000001";

const AUTO_WA = "d0000000-0000-0000-0000-000000000010";
const AUTO_TG = "d0000000-0000-0000-0000-000000000011";
const AUTO_WG = "d0000000-0000-0000-0000-000000000012";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32) for deterministic data */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xcabbab01);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function randFloat(min: number, max: number): number {
  return +(min + rng() * (max - min)).toFixed(2);
}
function daysAgo(n: number, hoursFixed?: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hoursFixed ?? randInt(6, 22), randInt(0, 59), randInt(0, 59), 0);
  return d.toISOString();
}

// Idempotent guard: skip append-only inserts if rows already exist
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function appendOnlyCount(
  sb: any,
  table: string,
  tenantId: string,
): Promise<number> {
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🌱 seed-demo-advanced — tenant ${DEMO_TENANT_ID}\n`);

  // -------------------------------------------------------------------------
  // Runtime lookups
  // -------------------------------------------------------------------------

  // Demo user id
  const { data: tuRow } = await sb
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", DEMO_TENANT_ID)
    .limit(1)
    .single();
  if (!tuRow) throw new Error("Demo tenant_users row not found — run seed-demo.ts first");
  const DEMO_USER_ID: string = (tuRow as { user_id: string }).user_id;

  // Sample bookings
  type BookingRow = {
    id: string;
    customer_handle: string;
    passenger_name: string;
    fare: number;
    automation_id: string;
    dispatch_adapter: string;
  };
  const { data: bookingsRaw } = await sb
    .from("bookings")
    .select("id, customer_handle, passenger_name, fare, automation_id, dispatch_adapter")
    .eq("tenant_id", DEMO_TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(60);
  const sampleBookings: BookingRow[] = (bookingsRaw as BookingRow[]) ?? [];
  if (sampleBookings.length === 0) {
    throw new Error("No bookings found — run seed-demo.ts first");
  }

  // Sample conversations
  type ConvRow = {
    id: string;
    customer_handle: string;
    customer_name: string;
    outcome: string;
    automation_id: string;
  };
  const { data: convsRaw } = await sb
    .from("conversations")
    .select("id, customer_handle, customer_name, outcome, automation_id")
    .eq("tenant_id", DEMO_TENANT_ID)
    .order("started_at", { ascending: false })
    .limit(60);
  const sampleConvs: ConvRow[] = (convsRaw as ConvRow[]) ?? [];

  // Automation_config rows
  const { data: acRaw } = await sb
    .from("automation_config")
    .select("*")
    .eq("tenant_id", DEMO_TENANT_ID);
  const automationConfigs = (acRaw as Record<string, unknown>[]) ?? [];

  // =========================================================================
  // 1. Alerting
  // =========================================================================
  console.log("── Alerting ─────────────────────────────────────────────");

  // Alerting seeds as a UNIT, gated on alert_events (append-only). Once events
  // exist, the on-delete-cascade from alert_events back to alert_rules is blocked
  // by the immutability trigger, so re-deleting alert_rules fails and inserts
  // would accumulate. Seeding rules/channels/events only when alert_events is
  // empty keeps re-runs (and 24h demo resets) idempotent.
  const aeCount = await appendOnlyCount(sb, "alert_events", DEMO_TENANT_ID);
  let ruleIds: string[] = [];
  let chanIds: string[] = [];
  if (aeCount > 0) {
    console.log(`  ✓ alerting (already seeded — ${aeCount} events; skipping rules/channels/events)`);
  } else {
    // alert_rules
    await sb.from("alert_rules").delete().eq("tenant_id", DEMO_TENANT_ID);
    const alertRulesInsert = [
      {
        tenant_id: DEMO_TENANT_ID,
        automation_id: AUTO_WA,
        name: "High abandonment rate",
        metric: "abandonment_rate",
        operator: "gt",
        threshold: 15,
        window_hours: 24,
        severity: "critical",
        enabled: true,
        created_by: DEMO_USER_ID,
      },
      {
        tenant_id: DEMO_TENANT_ID,
        automation_id: AUTO_WA,
        name: "Low booking count",
        metric: "bookings_count",
        operator: "lt",
        threshold: 1,
        window_hours: 6,
        severity: "warning",
        enabled: true,
        created_by: DEMO_USER_ID,
      },
      {
        tenant_id: DEMO_TENANT_ID,
        automation_id: AUTO_WA,
        name: "Slow response time",
        metric: "avg_response_time_ms",
        operator: "gt",
        threshold: 5000,
        window_hours: 1,
        severity: "info",
        enabled: false,
        created_by: DEMO_USER_ID,
      },
    ];
    const { data: insertedRules, error: arErr } = await sb
      .from("alert_rules")
      .insert(alertRulesInsert)
      .select("id");
    if (arErr) throw new Error(`alert_rules: ${arErr.message}`);
    ruleIds = (insertedRules as { id: string }[]).map((r) => r.id);
    console.log(`  ✓ alert_rules (${ruleIds.length})`);

    // notification_channels
    await sb.from("notification_channels").delete().eq("tenant_id", DEMO_TENANT_ID);
    const { data: insertedChans, error: ncErr } = await sb
      .from("notification_channels")
      .insert([
        {
          tenant_id: DEMO_TENANT_ID,
          type: "email",
          destination: "ops@premiercabs.example",
          enabled: true,
          verified: true,
        },
        {
          tenant_id: DEMO_TENANT_ID,
          type: "slack",
          destination: "https://hooks.slack.com/services/T000/B000/XXXX",
          enabled: true,
          verified: false,
        },
      ])
      .select("id");
    if (ncErr) throw new Error(`notification_channels: ${ncErr.message}`);
    chanIds = (insertedChans as { id: string }[]).map((c) => c.id);
    console.log(`  ✓ notification_channels (${chanIds.length})`);

    // alert_events (append-only — inserted here while empty)
    const alertEventsInsert = [
      { tenant_id: DEMO_TENANT_ID, rule_id: ruleIds[0], value: 18.5, status: "firing", fired_at: daysAgo(13) },
      { tenant_id: DEMO_TENANT_ID, rule_id: ruleIds[0], value: 22.1, status: "resolved", fired_at: daysAgo(10) },
      { tenant_id: DEMO_TENANT_ID, rule_id: ruleIds[1], value: 0, status: "firing", fired_at: daysAgo(7) },
      { tenant_id: DEMO_TENANT_ID, rule_id: ruleIds[2], value: 6200, status: "resolved", fired_at: daysAgo(3) },
      { tenant_id: DEMO_TENANT_ID, rule_id: ruleIds[0], value: 16.0, status: "acked", fired_at: daysAgo(1) },
    ];
    const { error: aeErr } = await sb.from("alert_events").insert(alertEventsInsert);
    if (aeErr) throw new Error(`alert_events: ${aeErr.message}`);
    console.log(`  ✓ alert_events (${alertEventsInsert.length})`);
  }

  // notification_log (APPEND-ONLY guard)
  const nlCount = await appendOnlyCount(sb, "notification_log", DEMO_TENANT_ID);
  if (nlCount > 0 || chanIds.length === 0) {
    console.log(`  ✓ notification_log (${nlCount} — already seeded or alerting skipped)`);
  } else {
    const notifLogInsert = [
      { tenant_id: DEMO_TENANT_ID, channel_id: chanIds[0], alert_event_id: null, type: "email", status: "sent", sent_at: daysAgo(13) },
      { tenant_id: DEMO_TENANT_ID, channel_id: chanIds[1], alert_event_id: null, type: "slack", status: "sent", sent_at: daysAgo(13) },
      { tenant_id: DEMO_TENANT_ID, channel_id: chanIds[0], alert_event_id: null, type: "email", status: "sent", sent_at: daysAgo(10) },
      { tenant_id: DEMO_TENANT_ID, channel_id: chanIds[0], alert_event_id: null, type: "email", status: "sent", sent_at: daysAgo(7) },
      { tenant_id: DEMO_TENANT_ID, channel_id: chanIds[1], alert_event_id: null, type: "slack", status: "failed", error: "Channel not found", sent_at: daysAgo(3) },
      { tenant_id: DEMO_TENANT_ID, channel_id: chanIds[0], alert_event_id: null, type: "email", status: "sent", sent_at: daysAgo(1) },
    ];
    const { error: nlErr } = await sb.from("notification_log").insert(notifLogInsert);
    if (nlErr) throw new Error(`notification_log: ${nlErr.message}`);
    console.log(`  ✓ notification_log (${notifLogInsert.length})`);
  }

  // =========================================================================
  // 2. CRM — customers, customer_notes, update bookings
  // =========================================================================
  console.log("── CRM ──────────────────────────────────────────────────");

  await sb.from("customer_notes").delete().eq("tenant_id", DEMO_TENANT_ID);
  await sb.from("customers").delete().eq("tenant_id", DEMO_TENANT_ID);

  // Derive ~20 customers from sample bookings by customer_handle
  const handleMap = new Map<
    string,
    { name: string; bookings: number; spend: number; first: string; last: string }
  >();
  for (const b of sampleBookings) {
    const entry = handleMap.get(b.customer_handle);
    const now = new Date().toISOString();
    if (!entry) {
      handleMap.set(b.customer_handle, {
        name: b.passenger_name,
        bookings: 1,
        spend: b.fare ?? 0,
        first: now,
        last: now,
      });
    } else {
      entry.bookings++;
      entry.spend += b.fare ?? 0;
    }
  }

  // Cap at 20 customers
  const customerEntries = Array.from(handleMap.entries()).slice(0, 20);
  const customersInsert = customerEntries.map(([handle, info], i) => ({
    tenant_id: DEMO_TENANT_ID,
    customer_handle: handle,
    name: info.name,
    first_seen: daysAgo(randInt(30, 180)),
    last_seen: daysAgo(randInt(0, 14)),
    total_bookings: info.bookings,
    total_spend: +info.spend.toFixed(2),
    preferred_vehicle: "saloon",
    vip: i < 3,
    blocked: i >= 18,
    tags: i < 3 ? ["vip", "regular"] : i >= 18 ? ["blocked"] : [],
  }));

  const { data: insertedCustomers, error: custErr } = await sb
    .from("customers")
    .insert(customersInsert)
    .select("id, customer_handle");
  if (custErr) throw new Error(`customers: ${custErr.message}`);
  const customers = (insertedCustomers as { id: string; customer_handle: string }[]);
  console.log(`  ✓ customers (${customers.length})`);

  // customer_notes on first 2 customers
  if (customers.length >= 2) {
    const notesInsert = [
      {
        customer_id: customers[0].id,
        tenant_id: DEMO_TENANT_ID,
        author_id: DEMO_USER_ID,
        body: "Regular Heathrow airport run — always requests meet & greet.",
        created_at: daysAgo(14),
      },
      {
        customer_id: customers[0].id,
        tenant_id: DEMO_TENANT_ID,
        author_id: DEMO_USER_ID,
        body: "Prefers estate car for luggage.",
        created_at: daysAgo(7),
      },
      {
        customer_id: customers[1].id,
        tenant_id: DEMO_TENANT_ID,
        author_id: DEMO_USER_ID,
        body: "Monthly corporate account runs — invoice separately.",
        created_at: daysAgo(21),
      },
      {
        customer_id: customers[1].id,
        tenant_id: DEMO_TENANT_ID,
        author_id: DEMO_USER_ID,
        body: "Contacted re: lost property — resolved.",
        created_at: daysAgo(5),
      },
    ];
    const { error: cnErr } = await sb.from("customer_notes").insert(notesInsert);
    if (cnErr) throw new Error(`customer_notes: ${cnErr.message}`);
    console.log(`  ✓ customer_notes (${notesInsert.length})`);
  }

  // Update ~30 demo bookings to set customer_id by matching customer_handle
  const custByHandle = new Map(customers.map((c) => [c.customer_handle, c.id]));
  let custLinked = 0;
  for (const b of sampleBookings.slice(0, 30)) {
    const custId = custByHandle.get(b.customer_handle);
    if (!custId) continue;
    await sb.from("bookings").update({ customer_id: custId }).eq("id", b.id);
    custLinked++;
  }
  console.log(`  ✓ bookings.customer_id linked (${custLinked})`);

  // =========================================================================
  // 3. Config — versions, fare_rules, guardrails
  // =========================================================================
  console.log("── Config control plane ─────────────────────────────────");

  await sb.from("config_guardrails").delete().eq("automation_id", AUTO_WA);
  await sb.from("fare_rules").delete().eq("tenant_id", DEMO_TENANT_ID);
  await sb.from("config_versions").delete().eq("tenant_id", DEMO_TENANT_ID);

  const vehicleTypes = ["saloon", "estate", "mpv", "8seater", "wheelchair"];
  const fareData: Record<string, [number, number, number, number, number]> = {
    saloon:     [3.50, 1.80, 0.30,  8.00, 5.00],
    estate:     [4.00, 2.00, 0.35, 10.00, 7.00],
    mpv:        [4.50, 2.20, 0.40, 12.00, 8.00],
    "8seater":  [5.50, 2.50, 0.45, 15.00, 10.00],
    wheelchair: [5.00, 2.30, 0.40, 12.00, 8.00],
  };

  const allVersionIds: Record<string, string> = {};

  for (const autoId of [AUTO_WA]) {
    // Config snapshot — use automation_config data if available
    const acRow = automationConfigs.find(
      (r) => r["automation_id"] === autoId,
    );
    const configSnapshot = acRow
      ? { ...acRow }
      : { service_area: "Greater London", vehicle_types: vehicleTypes, welcome_messages: { en: "Hi!" } };

    // v1 — published
    const { data: v1, error: v1Err } = await sb
      .from("config_versions")
      .insert({
        automation_id: autoId,
        tenant_id: DEMO_TENANT_ID,
        version: 1,
        config: configSnapshot,
        status: "published",
        change_note: "Initial published config",
        created_by: DEMO_USER_ID,
        published_by: DEMO_USER_ID,
        published_at: daysAgo(30),
        created_at: daysAgo(31),
      })
      .select("id")
      .single();
    if (v1Err) throw new Error(`config_versions v1 (${autoId}): ${v1Err.message}`);
    const v1Id = (v1 as { id: string }).id;
    allVersionIds[`${autoId}_v1`] = v1Id;

    // v2 — draft
    const { error: v2Err } = await sb.from("config_versions").insert({
      automation_id: autoId,
      tenant_id: DEMO_TENANT_ID,
      version: 2,
      config: { ...configSnapshot, service_area: "Greater London + M25", languages: ["en", "ar"] },
      status: "draft",
      change_note: "Expanding service area + Arabic",
      created_by: DEMO_USER_ID,
      created_at: daysAgo(2),
    });
    if (v2Err) throw new Error(`config_versions v2 (${autoId}): ${v2Err.message}`);

    // Update automation_config.current_version_id
    await sb
      .from("automation_config")
      .update({ current_version_id: v1Id })
      .eq("automation_id", autoId);

    // Fare rules
    const fareInserts = vehicleTypes.map((vt) => {
      const [base, perMile, perMin, minFare, airportSurcharge] = fareData[vt];
      return {
        tenant_id: DEMO_TENANT_ID,
        automation_id: autoId,
        vehicle_type: vt,
        base_fare: base,
        per_mile: perMile,
        per_min: perMin,
        min_fare: minFare,
        airport_surcharge: airportSurcharge,
        currency: "GBP",
      };
    });
    const { error: frErr } = await sb.from("fare_rules").insert(fareInserts);
    if (frErr) throw new Error(`fare_rules (${autoId}): ${frErr.message}`);
  }

  // Guardrails on AUTO_WA only
  const { error: guardErr } = await sb.from("config_guardrails").insert([
    { automation_id: AUTO_WA, field: "service_area", locked: true, min_value: null, max_value: null },
    { automation_id: AUTO_WA, field: "min_fare", locked: false, min_value: 5, max_value: 20 },
    { automation_id: AUTO_WA, field: "vehicle_types", locked: true, min_value: null, max_value: null },
  ]);
  if (guardErr) throw new Error(`config_guardrails: ${guardErr.message}`);

  console.log(`  ✓ config_versions (${Object.keys(allVersionIds).length} published, same count drafts)`);
  console.log(`  ✓ fare_rules (${vehicleTypes.length * 3} total across automations)`);
  console.log(`  ✓ config_guardrails (3 on AUTO_WA)`);

  // =========================================================================
  // 4. Live ops — conversation takeovers + human messages
  // =========================================================================
  console.log("── Live ops ─────────────────────────────────────────────");

  // Update 3 conversations to human takeover
  const takeovers = sampleConvs.slice(0, 3);
  for (const conv of takeovers) {
    const takeoverAt = daysAgo(randInt(1, 5));
    await sb.from("conversations").update({
      takeover_status: "human",
      assigned_to: DEMO_USER_ID,
      takeover_at: takeoverAt,
      last_human_reply_at: daysAgo(randInt(0, 1)),
    }).eq("id", conv.id);
  }
  console.log(`  ✓ conversations takeover updated (${takeovers.length})`);

  // Insert human messages on first takeover conversation
  if (takeovers.length > 0) {
    const humanMsgs = [
      {
        conversation_id: takeovers[0].id,
        direction: "outbound",
        message_type: "text",
        payload: { text: "Hi, I'm Sarah from Premier Cabs — I'll help you directly. What's the issue?" },
        source: "human",
        sent_by_user_id: DEMO_USER_ID,
        ts: daysAgo(1, 14),
      },
      {
        conversation_id: takeovers[0].id,
        direction: "outbound",
        message_type: "text",
        payload: { text: "I've rebooked you for 30 minutes later. Confirmation sent. Anything else?" },
        source: "human",
        sent_by_user_id: DEMO_USER_ID,
        ts: daysAgo(1, 15),
      },
    ];
    const { error: hmErr } = await sb.from("messages").insert(humanMsgs);
    if (hmErr) console.warn(`  ⚠ human messages: ${hmErr.message}`);
    else console.log(`  ✓ messages[source=human] (${humanMsgs.length})`);
  }

  // =========================================================================
  // 5. Dispatch ops
  // =========================================================================
  console.log("── Dispatch ops ─────────────────────────────────────────");

  // Update automations dispatch_mode to live
  await sb
    .from("automations")
    .update({ dispatch_mode: "live" })
    .in("id", [AUTO_WA, AUTO_TG, AUTO_WG]);
  console.log(`  ✓ automations.dispatch_mode = live`);

  // Update ~20 bookings with quoted_fare
  for (const b of sampleBookings.slice(0, 20)) {
    const delta = randFloat(-3, 5);
    await sb
      .from("bookings")
      .update({ quoted_fare: +((b.fare ?? 20) + delta).toFixed(2) })
      .eq("id", b.id);
  }
  console.log(`  ✓ bookings.quoted_fare updated (20)`);

  // dispatch_attempts (APPEND-ONLY guard)
  const daCount = await appendOnlyCount(sb, "dispatch_attempts", DEMO_TENANT_ID);
  if (daCount > 0) {
    console.log(`  ✓ dispatch_attempts (${daCount} — already seeded, skipping)`);
  } else {
    const dispatchRows = sampleBookings.map((b, i) => {
      const failed = i % 5 === 4; // ~20% fail rate
      return {
        tenant_id: DEMO_TENANT_ID,
        automation_id: b.automation_id,
        booking_id: b.id,
        adapter: "autocab",
        operation: "create",
        status: failed ? "failed" : "success",
        latency_ms: failed ? randInt(3000, 6000) : randInt(80, 900),
        attempt_no: failed ? 2 : 1,
        request: { bookingRef: `DEMO-${randInt(100000, 999999)}` },
        response: failed ? null : { status: "CONFIRMED", ref: `AC${randInt(10000, 99999)}` },
        error: failed ? "AutoCab timeout after 30s — retrying" : null,
        created_at: daysAgo(randInt(0, 14)),
      };
    });

    // Pad to 40 rows with extra entries
    const extra = Array.from({ length: Math.max(0, 40 - dispatchRows.length) }, (_, i) => ({
      tenant_id: DEMO_TENANT_ID,
      automation_id: pick([AUTO_WA] as const),
      booking_id: null,
      adapter: "autocab",
      operation: "lookup",
      status: i % 4 === 0 ? "failed" : "success",
      latency_ms: randInt(100, 2000),
      attempt_no: 1,
      request: { operation: "fare_lookup" },
      response: i % 4 === 0 ? null : { fare: randFloat(15, 80) },
      error: i % 4 === 0 ? "Connection refused" : null,
      created_at: daysAgo(randInt(0, 14)),
    }));

    const allDispatch = [...dispatchRows, ...extra];
    const { error: daErr } = await sb.from("dispatch_attempts").insert(allDispatch);
    if (daErr) throw new Error(`dispatch_attempts: ${daErr.message}`);
    console.log(`  ✓ dispatch_attempts (${allDispatch.length})`);
  }

  // =========================================================================
  // 6. Conversation intelligence
  // =========================================================================
  console.log("── Intelligence ─────────────────────────────────────────");

  const sentiments = ["positive", "neutral", "negative"] as const;
  const qaFlagOptions = [["slow"], ["abandoned"], ["wrong_info"], [], [], []] as const;

  // Update ~40 conversations with QA data
  const convsForQA = sampleConvs.slice(0, Math.min(40, sampleConvs.length));
  for (const [i, conv] of convsForQA.entries()) {
    await sb.from("conversations").update({
      qa_score: randInt(50, 98),
      qa_flags: qaFlagOptions[i % qaFlagOptions.length],
      sentiment: pick(sentiments),
      intent_summary: pick([
        "Customer wanted a taxi to Heathrow Terminal 5",
        "Customer enquired about pricing for airport run",
        "Booking modification — changed pickup time",
        "Complaint about previous journey",
        "Regular booking for city centre",
      ]),
      flagged_for_review: i < 6,
    }).eq("id", conv.id);
  }
  console.log(`  ✓ conversations QA fields updated (${convsForQA.length})`);

  // Delete-then-insert conversation_reviews
  await sb.from("conversation_reviews").delete().eq("tenant_id", DEMO_TENANT_ID);

  if (sampleConvs.length >= 4) {
    const reviewLabels = ["good", "bad_understanding", "too_slow", "wrong_info"] as const;
    const reviewsInsert = sampleConvs.slice(0, 4).map((conv, i) => ({
      conversation_id: conv.id,
      tenant_id: DEMO_TENANT_ID,
      reviewer_id: DEMO_USER_ID,
      rating: [5, 3, 2, 4][i],
      label: reviewLabels[i],
      note: [
        "Great handling of airport pickup details",
        "Bot misunderstood 'Gatwick' as destination not origin",
        "Took too long to confirm vehicle type",
        "Vehicle type confirmation needed clearer phrasing",
      ][i],
      used_for_training: i < 2,
    }));
    const { error: crErr } = await sb.from("conversation_reviews").insert(reviewsInsert);
    if (crErr) throw new Error(`conversation_reviews: ${crErr.message}`);
    console.log(`  ✓ conversation_reviews (${reviewsInsert.length})`);
  }

  // =========================================================================
  // 7. Account invoicing
  // =========================================================================
  console.log("── Account invoicing ────────────────────────────────────");

  await sb.from("tenant_invoices").delete().eq("tenant_id", DEMO_TENANT_ID);
  await sb.from("account_customers").delete().eq("tenant_id", DEMO_TENANT_ID);

  const { data: insertedAccounts, error: acErr } = await sb
    .from("account_customers")
    .insert([
      { tenant_id: DEMO_TENANT_ID, name: "Globex Ltd", billing_email: "accounts@globex.example", credit_terms: 30, markup_pct: 5.00, active: true },
      { tenant_id: DEMO_TENANT_ID, name: "Initech", billing_email: "finance@initech.example", credit_terms: 30, markup_pct: 10.00, active: true },
      { tenant_id: DEMO_TENANT_ID, name: "Wayne Enterprises", billing_email: "billing@wayneent.example", credit_terms: 30, markup_pct: 0.00, active: true },
    ])
    .select("id");
  if (acErr) throw new Error(`account_customers: ${acErr.message}`);
  const accountIds = (insertedAccounts as { id: string }[]).map((a) => a.id);
  console.log(`  ✓ account_customers (${accountIds.length})`);

  // Update ~15 bookings with account_customer_id + payment_status
  const payStatuses = ["invoiced", "paid"] as const;
  for (const [i, b] of sampleBookings.slice(0, 15).entries()) {
    await sb.from("bookings").update({
      account_customer_id: accountIds[i % accountIds.length],
      payment_status: pick(payStatuses),
    }).eq("id", b.id);
  }
  console.log(`  ✓ bookings.account_customer_id linked (15)`);

  // tenant_invoices
  const lastMonthStart = new Date();
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  lastMonthStart.setDate(1);
  const lastMonthEnd = new Date(lastMonthStart);
  lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);
  lastMonthEnd.setDate(0);

  const { error: tiErr } = await sb.from("tenant_invoices").insert([
    {
      tenant_id: DEMO_TENANT_ID,
      account_customer_id: accountIds[0],
      period_start: lastMonthStart.toISOString().slice(0, 10),
      period_end: lastMonthEnd.toISOString().slice(0, 10),
      line_items: [
        { description: "Airport runs × 8", amount: 640.00 },
        { description: "City transfers × 12", amount: 360.00 },
      ],
      subtotal: 1000.00,
      markup: 50.00,
      total: 1050.00,
      currency: "GBP",
      status: "issued",
      issued_at: daysAgo(5),
    },
    {
      tenant_id: DEMO_TENANT_ID,
      account_customer_id: accountIds[1],
      period_start: lastMonthStart.toISOString().slice(0, 10),
      period_end: lastMonthEnd.toISOString().slice(0, 10),
      line_items: [
        { description: "Executive transfers × 6", amount: 480.00 },
        { description: "Heathrow collections × 4", amount: 320.00 },
      ],
      subtotal: 800.00,
      markup: 80.00,
      total: 880.00,
      currency: "GBP",
      status: "paid",
      issued_at: daysAgo(15),
    },
  ]);
  if (tiErr) throw new Error(`tenant_invoices: ${tiErr.message}`);
  console.log(`  ✓ tenant_invoices (2)`);

  // =========================================================================
  // 8. Reporting
  // =========================================================================
  console.log("── Reporting ────────────────────────────────────────────");

  // Reporting seeds as a UNIT, gated on report_runs (append-only). report_runs
  // → report_definitions is ON DELETE SET NULL, which is an UPDATE the
  // immutability trigger blocks once runs exist — so re-deleting definitions
  // fails and would accumulate. Seed both only when report_runs is empty.
  const rrCount = await appendOnlyCount(sb, "report_runs", DEMO_TENANT_ID);
  let reportIds: string[] = [];
  if (rrCount > 0) {
    console.log(`  ✓ reporting (already seeded — ${rrCount} runs; skipping definitions + runs)`);
  } else {
    await sb.from("report_definitions").delete().eq("tenant_id", DEMO_TENANT_ID);
    const { data: insertedReports, error: rdErr } = await sb
      .from("report_definitions")
      .insert([
        {
          tenant_id: DEMO_TENANT_ID,
          name: "Monthly Performance",
          metrics: ["revenue", "bookings"],
          filters: { period: "last_month" },
          schedule: "0 8 1 * *",
          format: "json",
          recipients: ["ops@premiercabs.example"],
          white_label: true,
          enabled: true,
          created_by: DEMO_USER_ID,
        },
        {
          tenant_id: DEMO_TENANT_ID,
          name: "Response Health",
          metrics: ["response_time"],
          filters: { automations: [AUTO_WA] },
          schedule: null,
          format: "json",
          recipients: [],
          white_label: false,
          enabled: true,
          created_by: DEMO_USER_ID,
        },
      ])
      .select("id");
    if (rdErr) throw new Error(`report_definitions: ${rdErr.message}`);
    reportIds = (insertedReports as { id: string }[]).map((r) => r.id);
    console.log(`  ✓ report_definitions (${reportIds.length})`);

    const reportRunsInsert = [
      {
        report_id: reportIds[0],
        tenant_id: DEMO_TENANT_ID,
        status: "success",
        payload: { title: "Monthly Performance", generatedAt: daysAgo(2), sections: [{ title: "Revenue", value: "£8,420" }] },
        generated_at: daysAgo(2),
      },
      {
        report_id: reportIds[0],
        tenant_id: DEMO_TENANT_ID,
        status: "success",
        payload: { title: "Monthly Performance", generatedAt: daysAgo(32), sections: [{ title: "Revenue", value: "£7,810" }] },
        generated_at: daysAgo(32),
      },
      {
        report_id: reportIds[1],
        tenant_id: DEMO_TENANT_ID,
        status: "success",
        payload: { title: "Response Health", generatedAt: daysAgo(5), sections: [{ title: "Avg response", value: "2.4s" }] },
        generated_at: daysAgo(5),
      },
    ];
    const { error: rrErr } = await sb.from("report_runs").insert(reportRunsInsert);
    if (rrErr) throw new Error(`report_runs: ${rrErr.message}`);
    console.log(`  ✓ report_runs (${reportRunsInsert.length})`);
  }

  // Update tenants.branding
  const { error: brandErr } = await sb
    .from("tenants")
    .update({
      branding: {
        logoUrl: "https://dummyimage.com/120x40/1e40af/fff&text=Premier",
        primary: "#1E40AF",
        accent: "#F59E0B",
      },
    })
    .eq("id", DEMO_TENANT_ID);
  if (brandErr) throw new Error(`tenants.branding: ${brandErr.message}`);
  console.log(`  ✓ tenants.branding updated`);

  // =========================================================================
  // 9. Self-serve channels
  // =========================================================================
  console.log("── Self-serve channels ──────────────────────────────────");

  // Delete existing self-serve channels for this tenant, then insert
  await sb
    .from("channels")
    .delete()
    .eq("tenant_id", DEMO_TENANT_ID)
    .eq("is_self_serve", true);

  const { error: ssErr } = await sb.from("channels").insert({
    tenant_id: DEMO_TENANT_ID,
    automation_id: AUTO_WA,
    type: "whatsapp",
    external_id: "+44 7700 900 OVRF",
    webhook_path: `/webhooks/whatsapp/${AUTO_WA}`,
    credentials_ref: null,
    status: "disconnected",
    provisioning_status: "pending_review",
    is_self_serve: true,
    created_by: DEMO_USER_ID,
    created_at: daysAgo(2),
  });
  if (ssErr) throw new Error(`channels (self-serve): ${ssErr.message}`);
  console.log(`  ✓ channels (self-serve, 1)`);

  // =========================================================================
  // 10. Integrations — api_keys, outbound_webhooks, webhook_deliveries
  // =========================================================================
  console.log("── Integrations ─────────────────────────────────────────");

  await sb.from("api_keys").delete().eq("tenant_id", DEMO_TENANT_ID);

  // Generate api keys
  function makeApiKey() {
    const raw = "cab_" + randomBytes(24).toString("hex");
    const prefix = raw.slice(0, 12);
    const key_hash = createHash("sha256").update(raw).digest("hex");
    return { raw, prefix, key_hash };
  }

  const key1 = makeApiKey();
  const key2 = makeApiKey();

  const { error: akErr } = await sb.from("api_keys").insert([
    {
      tenant_id: DEMO_TENANT_ID,
      name: "Production integration",
      prefix: key1.prefix,
      key_hash: key1.key_hash,
      scopes: ["bookings:read", "conversations:read"],
      rate_limit_tier: "standard",
      last_used_at: daysAgo(1),
      created_by: DEMO_USER_ID,
      revoked_at: null,
      created_at: daysAgo(60),
    },
    {
      tenant_id: DEMO_TENANT_ID,
      name: "Old test key (revoked)",
      prefix: key2.prefix,
      key_hash: key2.key_hash,
      scopes: [],
      rate_limit_tier: "standard",
      last_used_at: daysAgo(30),
      created_by: DEMO_USER_ID,
      revoked_at: daysAgo(20),
      created_at: daysAgo(90),
    },
  ]);
  if (akErr) throw new Error(`api_keys: ${akErr.message}`);
  console.log(`  ✓ api_keys (2)`);

  // outbound_webhooks seeds as a UNIT, gated on webhook_deliveries (append-only):
  // webhook_deliveries → outbound_webhooks is ON DELETE SET NULL (an UPDATE the
  // immutability trigger blocks once deliveries exist), so re-deleting webhooks
  // fails and would accumulate. Seed both only when webhook_deliveries is empty.
  const wdCount = await appendOnlyCount(sb, "webhook_deliveries", DEMO_TENANT_ID);
  let webhookIds: string[] = [];
  if (wdCount > 0) {
    console.log(`  ✓ webhooks (already seeded — ${wdCount} deliveries; skipping outbound_webhooks + deliveries)`);
  } else {
    await sb.from("outbound_webhooks").delete().eq("tenant_id", DEMO_TENANT_ID);
    const { data: insertedWebhooks, error: owErr } = await sb
      .from("outbound_webhooks")
      .insert([
        {
          tenant_id: DEMO_TENANT_ID,
          url: "https://premiercabs.example/hook",
          events: ["booking.created", "booking.cancelled"],
          secret: "whsec_" + randomBytes(16).toString("hex"),
          enabled: true,
          failure_count: 0,
          created_at: daysAgo(45),
        },
        {
          tenant_id: DEMO_TENANT_ID,
          url: "https://premiercabs.example/analytics-hook",
          events: ["conversation.ended"],
          secret: "whsec_" + randomBytes(16).toString("hex"),
          enabled: true,
          failure_count: 2,
          created_at: daysAgo(20),
        },
      ])
      .select("id");
    if (owErr) throw new Error(`outbound_webhooks: ${owErr.message}`);
    webhookIds = (insertedWebhooks as { id: string }[]).map((w) => w.id);
    console.log(`  ✓ outbound_webhooks (${webhookIds.length})`);

    const wdInsert = [
      { webhook_id: webhookIds[0], tenant_id: DEMO_TENANT_ID, event: "booking.created", status: "delivered", response_code: 200, attempts: 1, delivered_at: daysAgo(1) },
      { webhook_id: webhookIds[0], tenant_id: DEMO_TENANT_ID, event: "booking.created", status: "delivered", response_code: 200, attempts: 1, delivered_at: daysAgo(2) },
      { webhook_id: webhookIds[0], tenant_id: DEMO_TENANT_ID, event: "booking.cancelled", status: "failed", response_code: 500, attempts: 3, delivered_at: daysAgo(3) },
      { webhook_id: webhookIds[1], tenant_id: DEMO_TENANT_ID, event: "conversation.ended", status: "delivered", response_code: 200, attempts: 1, delivered_at: daysAgo(1) },
      { webhook_id: webhookIds[1], tenant_id: DEMO_TENANT_ID, event: "conversation.ended", status: "failed", response_code: 500, attempts: 2, delivered_at: daysAgo(4) },
      { webhook_id: webhookIds[0], tenant_id: DEMO_TENANT_ID, event: "booking.created", status: "delivered", response_code: 200, attempts: 1, delivered_at: daysAgo(5) },
    ];
    const { error: wdErr } = await sb.from("webhook_deliveries").insert(wdInsert);
    if (wdErr) throw new Error(`webhook_deliveries: ${wdErr.message}`);
    console.log(`  ✓ webhook_deliveries (${wdInsert.length})`);
  }

  // =========================================================================
  // 11. AI Copilot
  // =========================================================================
  console.log("── AI Copilot ───────────────────────────────────────────");

  const cmCount = await appendOnlyCount(sb, "copilot_messages", DEMO_TENANT_ID);
  if (cmCount > 0) {
    console.log(`  ✓ copilot_messages (${cmCount} — already seeded, skipping)`);
  } else {
    const copilotInsert = [
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: DEMO_USER_ID,
        question: "How much revenue did we make this month?",
        answer: "Over the last 30 days you took £8,420 across 214 confirmed bookings — up 12% vs the previous month.",
        intent: "revenue",
        tokens: 42,
        cost_micros: 21000,
        created_at: daysAgo(1),
      },
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: DEMO_USER_ID,
        question: "How many bookings did we have last week?",
        answer: "Last week you had 47 confirmed bookings — WhatsApp drove 68% of those.",
        intent: "bookings_count",
        tokens: 38,
        cost_micros: 19000,
        created_at: daysAgo(2),
      },
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: DEMO_USER_ID,
        question: "What are our top destinations?",
        answer: "Your top destinations this month are: 1) Heathrow Terminal 5 (28%), 2) Canary Wharf (18%), 3) King's Cross (14%).",
        intent: "top_destinations",
        tokens: 52,
        cost_micros: 26000,
        created_at: daysAgo(3),
      },
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: DEMO_USER_ID,
        question: "What is our abandonment rate?",
        answer: "Your abandonment rate over the past 7 days is 8.4% — well within the 15% alert threshold.",
        intent: "abandonment_rate",
        tokens: 40,
        cost_micros: 20000,
        created_at: daysAgo(5),
      },
      {
        tenant_id: DEMO_TENANT_ID,
        user_id: DEMO_USER_ID,
        question: "Which automation is performing best?",
        answer: "Your WhatsApp Booking Bot (AUTO_WA) leads with £5,200 revenue and an 11% conversion uplift this month.",
        intent: "automation_performance",
        tokens: 45,
        cost_micros: 22500,
        created_at: daysAgo(7),
      },
    ];
    const { error: cmErr } = await sb.from("copilot_messages").insert(copilotInsert);
    if (cmErr) throw new Error(`copilot_messages: ${cmErr.message}`);
    console.log(`  ✓ copilot_messages (${copilotInsert.length})`);
  }

  // =========================================================================
  // 12. Metering
  // =========================================================================
  console.log("── Metering ─────────────────────────────────────────────");

  // usage_counters (delete-then-insert — not append-only)
  await sb.from("usage_counters").delete().eq("tenant_id", DEMO_TENANT_ID);

  const periodStart = new Date();
  periodStart.setDate(1);
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(0);
  const pStart = periodStart.toISOString().slice(0, 10);
  const pEnd = periodEnd.toISOString().slice(0, 10);

  const { error: ucErr } = await sb.from("usage_counters").insert([
    { tenant_id: DEMO_TENANT_ID, feature_key: "alerting", period_start: pStart, period_end: pEnd, used: 120, limit_amount: null },
    { tenant_id: DEMO_TENANT_ID, feature_key: "ai_copilot", period_start: pStart, period_end: pEnd, used: 3400, limit_amount: 5000 },
    { tenant_id: DEMO_TENANT_ID, feature_key: "api_access", period_start: pStart, period_end: pEnd, used: 210, limit_amount: null },
    { tenant_id: DEMO_TENANT_ID, feature_key: "scheduled_reports", period_start: pStart, period_end: pEnd, used: 3, limit_amount: 10 },
  ]);
  if (ucErr) throw new Error(`usage_counters: ${ucErr.message}`);
  console.log(`  ✓ usage_counters (4)`);

  // usage_events (APPEND-ONLY guard)
  const ueCount = await appendOnlyCount(sb, "usage_events", DEMO_TENANT_ID);
  if (ueCount > 0) {
    console.log(`  ✓ usage_events (${ueCount} — already seeded, skipping)`);
  } else {
    const featureKeys = ["alerting", "ai_copilot", "api_access", "scheduled_reports"] as const;
    const usageEventsInsert = Array.from({ length: 20 }, (_, i) => ({
      tenant_id: DEMO_TENANT_ID,
      feature_key: featureKeys[i % featureKeys.length],
      automation_id: pick([AUTO_WA] as const),
      quantity: randInt(1, 50),
      unit: "call",
      cost_micros: randInt(1000, 50000),
      metadata: { source: "api" },
      occurred_at: daysAgo(randInt(0, 30)),
    }));
    const { error: ueErr } = await sb.from("usage_events").insert(usageEventsInsert);
    if (ueErr) throw new Error(`usage_events: ${ueErr.message}`);
    console.log(`  ✓ usage_events (${usageEventsInsert.length})`);
  }

  // =========================================================================
  // Verification
  // =========================================================================
  console.log("\n── Verification ─────────────────────────────────────────");

  const checks: Array<[string, string, Record<string, string>]> = [
    ["alert_rules", "alert_rules", { tenant_id: DEMO_TENANT_ID }],
    ["notification_channels", "notification_channels", { tenant_id: DEMO_TENANT_ID }],
    ["alert_events", "alert_events", { tenant_id: DEMO_TENANT_ID }],
    ["customers", "customers", { tenant_id: DEMO_TENANT_ID }],
    ["config_versions", "config_versions", { tenant_id: DEMO_TENANT_ID }],
    ["fare_rules", "fare_rules", { tenant_id: DEMO_TENANT_ID }],
    ["dispatch_attempts", "dispatch_attempts", { tenant_id: DEMO_TENANT_ID }],
    ["conversation_reviews", "conversation_reviews", { tenant_id: DEMO_TENANT_ID }],
    ["account_customers", "account_customers", { tenant_id: DEMO_TENANT_ID }],
    ["tenant_invoices", "tenant_invoices", { tenant_id: DEMO_TENANT_ID }],
    ["report_definitions", "report_definitions", { tenant_id: DEMO_TENANT_ID }],
    ["report_runs", "report_runs", { tenant_id: DEMO_TENANT_ID }],
    ["api_keys", "api_keys", { tenant_id: DEMO_TENANT_ID }],
    ["outbound_webhooks", "outbound_webhooks", { tenant_id: DEMO_TENANT_ID }],
    ["copilot_messages", "copilot_messages", { tenant_id: DEMO_TENANT_ID }],
    ["usage_counters", "usage_counters", { tenant_id: DEMO_TENANT_ID }],
  ];

  for (const [label, table, filters] of checks) {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v);
    }
    const { count } = await q;
    console.log(`  ${label}: ${count ?? 0}`);
  }

  // Self-serve channels count
  const { count: ssCount } = await sb
    .from("channels")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", DEMO_TENANT_ID)
    .eq("is_self_serve", true);
  console.log(`  channels (is_self_serve=true): ${ssCount ?? 0}`);

  // conversations with qa_score set
  const { count: qaCount } = await sb
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", DEMO_TENANT_ID)
    .not("qa_score", "is", null);
  console.log(`  conversations[qa_score not null]: ${qaCount ?? 0}`);

  // bookings with account_customer_id set
  const { count: acBookCount } = await sb
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", DEMO_TENANT_ID)
    .not("account_customer_id", "is", null);
  console.log(`  bookings[account_customer_id not null]: ${acBookCount ?? 0}`);

  console.log(`\n✅ seed-demo-advanced complete for tenant ${DEMO_TENANT_ID}\n`);
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e);
  process.exit(1);
});
