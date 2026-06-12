#!/usr/bin/env node
/**
 * scripts/seed-entitlements.ts — idempotent.
 *
 * Upserts the feature catalog (from src/lib/entitlements/catalog.ts) into
 * public.features, three default plans (Ignition / In Motion / Full Throttle)
 * into public.plans, and their plan_features mapping. Safe to re-run.
 *
 * Usage: npx tsx scripts/seed-entitlements.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { FEATURE_KEYS, FEATURE_CATALOG, type FeatureKey } from "../src/lib/entitlements/catalog";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const PLANS = [
  { id: "b0000000-0000-0000-0000-000000000001", code: "starter", name: "Ignition", base_price: 149 },
  { id: "b0000000-0000-0000-0000-000000000002", code: "pro", name: "In Motion", base_price: 349 },
  { id: "b0000000-0000-0000-0000-000000000003", code: "enterprise", name: "Full Throttle", base_price: 749 },
];

// Which features each plan includes (+ quota where metered).
const PLAN_FEATURES: Record<string, Partial<Record<FeatureKey, { quota_limit: number | null; quota_period: "day" | "month" | null }>>> = {
  starter: {
    alerting: { quota_limit: 200, quota_period: "month" },
    crm: { quota_limit: null, quota_period: null },
    config_versioning: { quota_limit: null, quota_period: null },
  },
  pro: {
    live_takeover: { quota_limit: null, quota_period: null },
    alerting: { quota_limit: 2000, quota_period: "month" },
    crm: { quota_limit: null, quota_period: null },
    config_versioning: { quota_limit: null, quota_period: null },
    fare_rules: { quota_limit: null, quota_period: null },
    dispatch_retry: { quota_limit: null, quota_period: null },
    conversation_intelligence: { quota_limit: 500_000, quota_period: "month" },
    scheduled_reports: { quota_limit: 50, quota_period: "month" },
    self_serve_channels: { quota_limit: null, quota_period: null },
  },
  enterprise: Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, { quota_limit: null, quota_period: null }]),
  ) as Partial<Record<FeatureKey, { quota_limit: number | null; quota_period: "day" | "month" | null }>>,
};

async function main() {
  console.log("🌱 Seeding entitlements…");

  // 1. Features
  for (const k of FEATURE_KEYS) {
    const f = FEATURE_CATALOG[k];
    const { error } = await sb.from("features").upsert(
      { key: f.key, name: f.name, category: f.category, metered: f.metered, unit: f.unit ?? null },
      { onConflict: "key" },
    );
    if (error) throw new Error(`features upsert ${k}: ${error.message}`);
  }
  console.log(`  ✓ features (${FEATURE_KEYS.length})`);

  // 2. Plans
  for (const p of PLANS) {
    const { error } = await sb.from("plans").upsert(
      { id: p.id, code: p.code, name: p.name, base_price: p.base_price, currency: "GBP", is_active: true },
      { onConflict: "id" },
    );
    if (error) throw new Error(`plans upsert ${p.code}: ${error.message}`);
  }
  console.log(`  ✓ plans (${PLANS.length})`);

  // 3. plan_features
  for (const p of PLANS) {
    const feats = PLAN_FEATURES[p.code] ?? {};
    for (const [fk, q] of Object.entries(feats)) {
      const { error } = await sb.from("plan_features").upsert(
        { plan_id: p.id, feature_key: fk, enabled: true, quota_limit: q!.quota_limit, quota_period: q!.quota_period },
        { onConflict: "plan_id,feature_key" },
      );
      if (error) throw new Error(`plan_features upsert ${p.code}/${fk}: ${error.message}`);
    }
  }
  console.log("  ✓ plan_features");
  console.log("✅ Entitlements seed complete");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
