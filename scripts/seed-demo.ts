#!/usr/bin/env node
/**
 * scripts/seed-demo.ts — seed-demo
 *
 * Populates the demo tenant with 6 months of deterministic UK mock data.
 * Safe to re-run (upsert for stable rows; delete+insert for time-series).
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Required env (loaded from .env.local then .env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DEMO_SESSION_SECRET   (password for demo@demo.cabbybot.com)
 *   DEMO_TENANT_ID        (UUID; falls back to d0000000-0000-0000-0000-000000000001)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Deterministic seed IDs
// ---------------------------------------------------------------------------

export const DEMO_TENANT_ID =
  process.env.DEMO_TENANT_ID ?? "d0000000-0000-0000-0000-000000000001";

const DEMO_EMAIL = "demo@demo.cabbybot.com";

const AUTO_WA = "d0000000-0000-0000-0000-000000000010";
const AUTO_TG = "d0000000-0000-0000-0000-000000000011";
const AUTO_WG = "d0000000-0000-0000-0000-000000000012";

const CHAN_WA = "d0000000-0000-0000-0000-000000000020";
const CHAN_TG = "d0000000-0000-0000-0000-000000000021";
const CHAN_WG = "d0000000-0000-0000-0000-000000000022";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic, no external deps
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xdeadbeef);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function randFloat(min: number, max: number): number {
  return +(min + rng() * (max - min)).toFixed(2);
}

// ---------------------------------------------------------------------------
// UK address fixtures
// ---------------------------------------------------------------------------

const LONDON_ADDRESSES = [
  { formatted: "10 Downing Street, London SW1A 2AA", lat: 51.5034, lng: -0.1276 },
  { formatted: "221B Baker Street, London NW1 6XE", lat: 51.5238, lng: -0.1585 },
  { formatted: "30 St Mary Axe, London EC3A 8EP", lat: 51.5141, lng: -0.0813 },
  { formatted: "1 Canada Square, Canary Wharf, London E14 5AB", lat: 51.5054, lng: -0.0235 },
  { formatted: "King's Cross Station, London N1C 4AX", lat: 51.5308, lng: -0.1238 },
  { formatted: "Paddington Station, London W2 1FT", lat: 51.5154, lng: -0.1755 },
  { formatted: "Victoria Station, London SW1V 1JU", lat: 51.4952, lng: -0.1441 },
  { formatted: "London Bridge Station, London SE1 9SP", lat: 51.5052, lng: -0.0864 },
  { formatted: "Waterloo Station, London SE1 8SW", lat: 51.5031, lng: -0.1132 },
  { formatted: "Liverpool Street Station, London EC2M 7QH", lat: 51.5178, lng: -0.0813 },
  { formatted: "Shoreditch High Street, London E1 6JE", lat: 51.5226, lng: -0.0769 },
  { formatted: "Camden Market, London NW1 8AF", lat: 51.5414, lng: -0.1463 },
  { formatted: "Greenwich Park, London SE10 8QY", lat: 51.4769, lng: 0.0009 },
  { formatted: "Brixton Station, London SW9 8PH", lat: 51.4627, lng: -0.1145 },
  { formatted: "Stratford Station, London E15 1DD", lat: 51.5415, lng: 0.0008 },
] as const;

const LHR_TERMINALS = [
  { formatted: "Heathrow Terminal 1, London TW6 1JH", terminal: "T1", code: "LHR", lat: 51.4770, lng: -0.4613 },
  { formatted: "Heathrow Terminal 2, London TW6 1EW", terminal: "T2", code: "LHR", lat: 51.4771, lng: -0.4597 },
  { formatted: "Heathrow Terminal 3, London TW6 1QG", terminal: "T3", code: "LHR", lat: 51.4730, lng: -0.4507 },
  { formatted: "Heathrow Terminal 4, London TW6 3XA", terminal: "T4", code: "LHR", lat: 51.4590, lng: -0.4466 },
  { formatted: "Heathrow Terminal 5, London TW6 2GA", terminal: "T5", code: "LHR", lat: 51.4722, lng: -0.4876 },
] as const;

const FLIGHT_NUMBERS = [
  "BA0117", "BA0193", "BA0283", "BA0007", "LH0903",
  "EK0006", "VS0003", "AA0104", "IB3166", "QR0002",
] as const;

const PASSENGER_NAMES = [
  "James Wilson", "Sarah Ahmed", "Mohammed Al-Rashid", "Emma Thompson",
  "David Chen", "Priya Patel", "Oliver Bennett", "Fatima Hassan",
  "Thomas Hughes", "Aisha Begum", "George Mitchell", "Zara Ali",
  "Harry Davies", "Layla Noor", "Jack Morrison", "Meera Sharma",
] as const;

const VEHICLE_TYPES = ["Saloon", "Executive", "MPV"] as const;
const VEHICLE_WEIGHTS = [0.5, 0.3, 0.2];

function pickVehicle(): string {
  const r = rng();
  let cum = 0;
  for (let i = 0; i < VEHICLE_TYPES.length; i++) {
    cum += VEHICLE_WEIGHTS[i];
    if (r < cum) return VEHICLE_TYPES[i];
  }
  return "Saloon";
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(6, 23), randInt(0, 59), 0, 0);
  return d;
}

function isoStr(d: Date): string {
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

type MsgRow = {
  conversation_id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  payload: object;
  transcript?: string;
  ts: string;
};

function buildBookingMessages(
  convId: string,
  pickupAddr: string,
  destAddr: string,
  passengerName: string,
  fareStr: string,
  mode: "asap" | "scheduled",
): MsgRow[] {
  const base = new Date();
  base.setDate(base.getDate() - randInt(1, 180));
  base.setHours(randInt(7, 22), randInt(0, 59), 0, 0);
  const t = (s: number) => isoStr(new Date(base.getTime() + s * 1000));
  return [
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Hi! I'm your CabbyBot. Would you like to book a taxi, manage an existing booking, or get a quote?" }, ts: t(0) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "Book a taxi please" }, ts: t(8) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: mode === "asap" ? "Great! Is this for as soon as possible or a scheduled time?" : "Sure! When would you like to travel?" }, ts: t(10) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: mode === "asap" ? "As soon as possible" : "Tomorrow at 9am" }, ts: t(25) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "What's your pickup address?" }, ts: t(28) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: pickupAddr }, ts: t(55) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "And your destination?" }, ts: t(58) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: destAddr }, ts: t(80) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "What type of vehicle? Saloon, Executive, or MPV?" }, ts: t(83) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "Saloon" }, ts: t(95) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Your name for the booking?" }, ts: t(98) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: passengerName }, ts: t(115) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: `Quote: ${fareStr}. Confirm? Reply YES to confirm.` }, ts: t(120) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "YES" }, ts: t(135) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: `Booking confirmed! Your driver will be with you shortly. Reference: ABC${randInt(1000, 9999)}` }, ts: t(138) },
  ];
}

function buildCancelMessages(convId: string): MsgRow[] {
  const base = new Date();
  base.setDate(base.getDate() - randInt(1, 90));
  const t = (s: number) => isoStr(new Date(base.getTime() + s * 1000));
  return [
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Hi! How can I help today?" }, ts: t(0) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "I need to cancel my booking" }, ts: t(10) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "I can help with that. What's your booking reference?" }, ts: t(12) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: `ABC${randInt(1000, 9999)}` }, ts: t(30) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Found it. Your booking has been cancelled. We hope to see you again soon!" }, ts: t(35) },
  ];
}

function buildVoiceMessages(convId: string): MsgRow[] {
  const base = new Date();
  base.setDate(base.getDate() - randInt(1, 60));
  const t = (s: number) => isoStr(new Date(base.getTime() + s * 1000));
  return [
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Hi! How can I help today?" }, ts: t(0) },
    { conversation_id: convId, direction: "inbound", message_type: "voice", payload: { duration_sec: randInt(8, 25), mime_type: "audio/ogg" }, transcript: "I need a taxi from Paddington to Canary Wharf as soon as possible please", ts: t(8) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "I've received your voice message. Booking a Saloon from Paddington to Canary Wharf ASAP. Your name?" }, ts: t(15) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: pick(PASSENGER_NAMES) }, ts: t(28) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: `Quote: £${randInt(22, 45)}. Confirm? Reply YES.` }, ts: t(32) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "Yes" }, ts: t(45) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: `Confirmed! Reference: VBC${randInt(1000, 9999)}` }, ts: t(48) },
  ];
}

function buildManageMessages(convId: string): MsgRow[] {
  const base = new Date();
  base.setDate(base.getDate() - randInt(1, 60));
  const t = (s: number) => isoStr(new Date(base.getTime() + s * 1000));
  return [
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Hi! How can I help today?" }, ts: t(0) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "I want to check my booking" }, ts: t(9) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "I can help with that. What's your booking reference?" }, ts: t(11) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: `ABC${randInt(1000, 9999)}` }, ts: t(28) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Found your booking: Saloon pickup tomorrow at 9am from Paddington to Heathrow T5. Would you like to modify or cancel?" }, ts: t(33) },
    { conversation_id: convId, direction: "inbound", message_type: "text", payload: { text: "No thanks, just checking" }, ts: t(50) },
    { conversation_id: convId, direction: "outbound", message_type: "text", payload: { text: "Great! Your booking is confirmed. Is there anything else I can help with?" }, ts: t(53) },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const demoPassword = process.env.DEMO_SESSION_SECRET ?? "cabbybot-demo-2026";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("🌱 Seeding demo tenant…");

  // 1. Tenant
  const { error: tenantErr } = await sb.from("tenants").upsert({
    id: DEMO_TENANT_ID,
    name: "Premier Cabs London",
    slug: "premier-cabs-demo",
    country: "GB",
    plan_band: "A-Bundle",
    currency: "GBP",
    status: "active",
    dispatch_adapter: "autocab",
    dispatch_company_id: "DEMO001",
    is_demo: true,
    contract_start: "2025-09-01",
    contract_renewal: "2026-09-01",
    monthly_price: 149.00,
    setup_fee_paid: true,
    created_at: "2025-09-01T09:00:00Z",
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (tenantErr) throw new Error(`tenants upsert: ${tenantErr.message}`);
  console.log("  ✓ tenant");

  // 2. Demo user
  const { data: userList } = await sb.auth.admin.listUsers();
  const existingDemo = userList?.users?.find((u) => u.email === DEMO_EMAIL);
  let demoAuthId = existingDemo?.id;

  if (!demoAuthId) {
    const { data: newUser, error: createErr } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: demoPassword,
      email_confirm: true,
    });
    if (createErr || !newUser?.user?.id) throw new Error(`createUser: ${createErr?.message}`);
    demoAuthId = newUser.user.id;
    console.log("  ✓ auth user created");
  } else {
    await sb.auth.admin.updateUserById(demoAuthId, { password: demoPassword });
    console.log("  ✓ auth user refreshed");
  }

  await sb.from("users").upsert({
    id: demoAuthId,
    email: DEMO_EMAIL,
    full_name: "Demo User",
    is_demo_user: true,
    created_at: "2025-09-01T09:00:00Z",
  }, { onConflict: "id" });

  await sb.from("tenant_users").upsert({
    tenant_id: DEMO_TENANT_ID,
    user_id: demoAuthId,
    role: "Viewer",
    automation_restrictions: [],
    accepted_at: "2025-09-01T09:00:00Z",
  }, { onConflict: "tenant_id,user_id" });
  console.log("  ✓ demo user");

  // 3. Automations
  for (const [id, name, type] of [
    [AUTO_WA, "WA Booking Bot", "Booking"],
    [AUTO_TG, "Telegram Booking Bot", "Booking"],
    [AUTO_WG, "Widget Support Bot", "Support"],
  ] as const) {
    const { error } = await sb.from("automations").upsert({
      id, name, type,
      tenant_id: DEMO_TENANT_ID,
      status: "live",
      dispatch_adapter: "autocab",
      engine_workflow_id: `demo-wf-${id.slice(-4)}`,
      engine_project_id: `demo-proj-${DEMO_TENANT_ID.slice(-4)}`,
      created_at: "2025-09-01T09:00:00Z",
    }, { onConflict: "id" });
    if (error) throw new Error(`automations upsert ${name}: ${error.message}`);
  }
  console.log("  ✓ automations (3)");

  // 4. Channels
  for (const [id, autoId, type, extId, path] of [
    [CHAN_WA, AUTO_WA, "whatsapp", "+44 7700 900 DEMO", `/webhooks/whatsapp/${AUTO_WA}`],
    [CHAN_TG, AUTO_TG, "telegram", "@PremierCabsDemo", `/webhooks/telegram/${AUTO_TG}`],
    [CHAN_WG, AUTO_WG, "widget", "widget-demo", `/webhooks/widget/${AUTO_WG}`],
  ] as const) {
    const { error } = await sb.from("channels").upsert({
      id, tenant_id: DEMO_TENANT_ID, automation_id: autoId,
      type, external_id: extId, webhook_path: path,
      credentials_ref: null, status: "active",
      created_at: "2025-09-01T09:00:00Z",
    }, { onConflict: "id" });
    if (error) throw new Error(`channels upsert: ${error.message}`);
  }
  console.log("  ✓ channels (3)");

  // 5. Automation config
  for (const [autoId, langs, askNote] of [
    [AUTO_WA, ["en"], true],
    [AUTO_TG, ["en"], false],
    [AUTO_WG, ["en", "ar"], true],
  ] as const) {
    const { error } = await sb.from("automation_config").upsert({
      automation_id: autoId,
      tenant_id: DEMO_TENANT_ID,
      welcome_messages: { en: "Hi! I'm your CabbyBot. Book, quote, or manage a taxi? 🚕" },
      vehicle_types: ["Saloon", "Executive", "MPV"],
      service_area: "Greater London",
      opening_hours: { mon_fri: "06:00-23:00", weekend: "07:00-22:00" },
      brand_colours: { primary: "#1E40AF", accent: "#F59E0B" },
      languages: langs,
      ask_driver_note: askNote,
      updated_at: new Date().toISOString(),
    }, { onConflict: "automation_id" });
    if (error) throw new Error(`automation_config upsert: ${error.message}`);
  }
  console.log("  ✓ automation config");

  // 6. Automation runs
  const runStatuses = ["success", "success", "success", "error", "running"] as const;
  const runs: object[] = [];
  for (let day = 0; day < 180; day++) {
    for (let r = 0; r < randInt(2, 8); r++) {
      const autoId = pick([AUTO_WA, AUTO_TG, AUTO_WG] as const);
      const started = daysAgo(180 - day);
      const durationMs = randInt(120_000, 3_600_000);
      const status = pick(runStatuses);
      runs.push({
        automation_id: autoId,
        status,
        started_at: isoStr(started),
        finished_at: status !== "running" ? isoStr(new Date(started.getTime() + durationMs)) : null,
        duration_ms: status !== "running" ? durationMs : null,
        trigger_channel: pick(["whatsapp", "telegram", "widget"] as const),
        error_message: status === "error" ? "AutoCab timeout after 30s" : null,
      });
    }
  }
  await sb.from("automation_runs").delete().in("automation_id", [AUTO_WA, AUTO_TG, AUTO_WG]);
  for (let i = 0; i < runs.length; i += 100) {
    const { error } = await sb.from("automation_runs").insert(runs.slice(i, i + 100));
    if (error) throw new Error(`automation_runs insert: ${error.message}`);
  }
  console.log(`  ✓ automation runs (${runs.length})`);

  // 7. Conversations + messages + bookings
  await sb.from("bookings").delete().in("automation_id", [AUTO_WA, AUTO_TG, AUTO_WG]);
  const { data: existingConvs } = await sb.from("conversations").select("id").in("automation_id", [AUTO_WA, AUTO_TG, AUTO_WG]);
  if (existingConvs && existingConvs.length > 0) {
    const ids = (existingConvs as { id: string }[]).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 200) {
      await sb.from("messages").delete().in("conversation_id", ids.slice(i, i + 200));
    }
  }
  await sb.from("conversations").delete().in("automation_id", [AUTO_WA, AUTO_TG, AUTO_WG]);

  type ConvType = "booking_asap" | "booking_scheduled" | "booking_airport" | "cancel" | "manage" | "voice";
  const convWeights: Record<ConvType, number> = {
    booking_asap: 0.30, booking_scheduled: 0.28, booking_airport: 0.17,
    cancel: 0.08, manage: 0.08, voice: 0.09,
  };
  function pickConvType(): ConvType {
    const r = rng(); let cum = 0;
    for (const [type, w] of Object.entries(convWeights)) {
      cum += w; if (r < cum) return type as ConvType;
    }
    return "booking_asap";
  }

  const bookingStatuses = ["completed", "completed", "completed", "dispatched", "confirmed", "cancelled", "no_show"] as const;

  let totalConvs = 0, totalBookings = 0, totalMessages = 0;

  for (const autoId of [AUTO_WA, AUTO_TG, AUTO_WG] as const) {
    const chanId = autoId === AUTO_WA ? CHAN_WA : autoId === AUTO_TG ? CHAN_TG : CHAN_WG;
    const isBookingAuto = autoId !== AUTO_WG;
    for (let day = 0; day < 180; day++) {
      for (let c = 0; c < randInt(1, 4); c++) {
        const convType = pickConvType();
        // Widget Support Bot only generates manage/cancel/voice — no booking outcomes
        const effectiveConvType: ConvType = !isBookingAuto
          ? pick(["cancel", "manage", "voice"] as const)
          : convType;
        const started = daysAgo(180 - day);
        const outcome: string =
          !isBookingAuto ? "managed" :
          effectiveConvType === "cancel" ? "cancelled" :
          effectiveConvType === "manage" ? "managed" :
          ["booking_asap", "booking_scheduled", "booking_airport"].includes(effectiveConvType)
            ? (rng() > 0.08 ? "booked" : "abandoned") : "abandoned";

        const customerHandle = `+44 7${randInt(700, 999)} ${randInt(100000, 999999)}`;
        const customerName = pick(PASSENGER_NAMES);

        const { data: convData, error: convErr } = await sb.from("conversations").insert({
          tenant_id: DEMO_TENANT_ID,
          automation_id: autoId,
          channel_id: chanId,
          customer_handle: customerHandle,
          customer_name: customerName,
          language: rng() > 0.95 ? "ar" : "en",
          started_at: isoStr(started),
          ended_at: isoStr(new Date(started.getTime() + randInt(60, 600) * 1000)),
          outcome,
        }).select("id").single();

        if (convErr || !convData) continue;
        const convId = (convData as { id: string }).id;
        totalConvs++;

        const pickup = pick(LONDON_ADDRESSES);
        const dest = effectiveConvType === "booking_airport"
          ? pick(LHR_TERMINALS)
          : pick(LONDON_ADDRESSES.filter((a) => a !== pickup));
        const fare = randFloat(15, 85);

        let msgs: MsgRow[];
        if (effectiveConvType === "voice") msgs = buildVoiceMessages(convId);
        else if (effectiveConvType === "cancel") msgs = buildCancelMessages(convId);
        else if (effectiveConvType === "manage") msgs = buildManageMessages(convId);
        else msgs = buildBookingMessages(convId, pickup.formatted, dest.formatted, customerName, `£${fare.toFixed(2)}`, effectiveConvType === "booking_asap" ? "asap" : "scheduled");

        if (msgs.length > 0) {
          const { error: msgErr } = await sb.from("messages").insert(msgs);
          if (msgErr) console.warn(`  ⚠ messages insert: ${msgErr.message}`);
          else totalMessages += msgs.length;
        }

        if (isBookingAuto && outcome === "booked") {
          const isAirport = effectiveConvType === "booking_airport";
          const terminal = isAirport ? (dest as { formatted: string; terminal: string; code: string; lat: number; lng: number }) : null;
          const mode = effectiveConvType === "booking_asap" ? "asap" : "scheduled";
          const pickupAt = new Date(started.getTime() + (mode === "asap" ? randInt(5, 30) : randInt(60, 2880)) * 60_000);

          const { error: bookErr } = await sb.from("bookings").insert({
            tenant_id: DEMO_TENANT_ID,
            automation_id: autoId,
            conversation_id: convId,
            channel_type: autoId === AUTO_WA ? "whatsapp" : autoId === AUTO_TG ? "telegram" : "widget",
            dispatch_ref: `DEMO-${randInt(100000, 999999)}`,
            dispatch_adapter: "autocab",
            passenger_name: customerName,
            customer_handle: customerHandle,
            pickup_address: pickup,
            destination_address: isAirport ? terminal : dest,
            vehicle_type: pickVehicle(),
            passenger_count: randInt(1, 4),
            fare,
            currency: "GBP",
            pickup_at_utc: isoStr(pickupAt),
            pickup_time_mode: mode,
            airport_json: isAirport && terminal ? { flight: pick(FLIGHT_NUMBERS), terminal: terminal.terminal, iata: terminal.code } : null,
            status: pick(bookingStatuses),
            raw_dispatch_json: { demo: true },
            created_at: isoStr(started),
          });
          if (bookErr) console.warn(`  ⚠ bookings insert: ${bookErr.message}`);
          else totalBookings++;
        }
      }
    }
  }

  console.log(`  ✓ conversations (${totalConvs}), messages (${totalMessages}), bookings (${totalBookings})`);
  console.log(`\n✅ Demo seed complete for tenant ${DEMO_TENANT_ID}`);
  console.log(`   Demo login: ${DEMO_EMAIL}`);
  console.log(`   Visit: /demo`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
