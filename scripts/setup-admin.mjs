#!/usr/bin/env node
/**
 * scripts/setup-admin.mjs — create the FlowMo-staff admin demo login.
 *
 * The JWT hook (custom_access_token_hook) sets is_flowmo_staff = (email LIKE
 * '%@flowmoai.com'), so the admin email MUST be @flowmoai.com. The admin has NO
 * tenant_users membership (role stays null → no MFA gate) and reaches /admin.
 *
 * Usage: node scripts/setup-admin.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_ADMIN_EMAIL,
 * DEMO_ADMIN_PASSWORD from .env.local then .env.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_ADMIN_EMAIL ?? "admin@flowmoai.com";
const password = process.env.DEMO_ADMIN_PASSWORD ?? "CabbyAdmin2026!";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!email.endsWith("@flowmoai.com")) {
  console.error(`Admin email must end with @flowmoai.com (got ${email}) or is_flowmo_staff will be false.`);
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Create or update the auth user (idempotent).
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);

  let authId;
  if (existing) {
    authId = existing.id;
    await sb.auth.admin.updateUserById(authId, { password, email_confirm: true });
    console.log(`  ✓ admin auth user updated (${email})`);
  } else {
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created?.user?.id) throw new Error(`createUser: ${error?.message}`);
    authId = created.user.id;
    console.log(`  ✓ admin auth user created (${email})`);
  }

  // Mirror into public.users (no tenant membership → FlowMo staff only).
  const { error: upErr } = await sb.from("users").upsert(
    { id: authId, email, full_name: "FlowMo Admin (Demo)", is_demo_user: false },
    { onConflict: "id" },
  );
  if (upErr) throw new Error(`public.users upsert: ${upErr.message}`);
  console.log("  ✓ public.users row");

  console.log(`\n✅ Admin login ready: ${email} / ${password}`);
  console.log("   Sign in at /login → redirected to /admin (FlowMo staff).");
}

main().catch((e) => {
  console.error("setup-admin failed:", e.message);
  process.exit(1);
});
