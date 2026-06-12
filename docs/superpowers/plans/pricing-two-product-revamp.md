# Plan — Two-Product Pricing Revamp (Chat + AI Voice, Mix & Match bundle)

**Branch:** `revamp/r1-two-product-schema` · **Date:** 2026-06-12

## Goal

Replace the multi-channel commercial model with two products — **WhatsApp Chatbot + Voice Note** and **AI Voice Booking Agent** — across marketing pricing, the ROI calculator, the billing libraries, Stripe wiring, the live Supabase schema, and the Admin + Tenant dashboards. Remove the "single channel vs channel bundle" concept entirely.

## New pricing (GBP source of truth)

### 1. Chat (WhatsApp Chat + Voice Note) — single price per tier
| Tier | Fleet | £/mo |
|---|---|---|
| Ignition | Up to 50 drivers | **599** |
| In Motion | 51–100 drivers | **999** |
| Full Throttle | 101+ drivers (optional 2nd WhatsApp chatbot) | **1299** (now priced, no longer contact-only) |

Setup fee: **£1000**.

### 2. AI Voice Booking — by monthly call allowance
| Tier | Calls/mo | Config | £/mo |
|---|---|---|---|
| Ignition | 1,500 | 1 number · 1 agent | **1299** |
| In Motion | 2,250 | 2 numbers · 2 agents | **1799** |
| Full Throttle | 3,000 | 2 numbers · 2 agents | **2199** |

Setup: 1 agent **£1000**, 2 agents **£1500**, second-agent add-on **£500**.

### 3. Double Decker — **Mix & Match** (compositional, not fixed tiers)
Pick **any** AI Voice tier (price unchanged) **+** any Chat tier; the **chat** portion is discounted:

| Chat tier | Normal | Bundle discount | Bundle chat price |
|---|---|---|---|
| Ignition | 599 | −100 | **499** |
| In Motion | 999 | −200 | **799** |
| Full Throttle | 1299 | −300 | **999** |

`bundleTotal(voiceTier, chatTier) = VOICE_PRICE[voiceTier] + bundleChatPrice[chatTier]`. Voice is never discounted.
Setup: 1 chat + 1 voice **£1500**; 1 chat + 2 voice **£2000**.

### Extra voice credit
**£0.90 per call** (per call, not per minute).

### Currency
Keep GBP/EUR/USD toggle. GBP default. EUR/USD derived live from `src/lib/marketing/fx.ts` (Frankfurter, 24h cache, fallback). Already implemented — no change needed beyond feeding it the new GBP numbers.

## Assumptions (defaults chosen; flagged for the user)
1. **Stripe**: code/price-mapping restructure only. The billing stack already creates subscriptions with inline `price_data` (no per-tier Price catalog), so no live Stripe catalog mutation is required. Setup fees stay one-off invoice items.
2. **Supabase**: migration applied directly to the live project via MCP (user pre-authorized; only 2 tenant rows, 1 demo). Affected rows snapshotted first.
3. **Legacy A/B `plan_band`**: retired. `commercial_model` (chat/voice/double_decker) + per-product subscription tier becomes the single source of truth. The one real tenant is migrated.
4. **"$" in the bundle brief** (`now $499/mo`) is a typo for **£** (GBP), confirmed by "£100 OFF Original £599/mo".
5. Scope is the **pricing/commercial model**, not a wholesale dashboard rebuild (the "remove all old dashboard features" line was dropped in the user's re-send).

## Work breakdown

### A. Pure data model (code-only, reversible) — do first
- `src/lib/marketing/pricing.ts`: `CHAT_TIERS` → single `priceGbp` (599/999/1299), Full Throttle priced; `VOICE_TIERS` → 1299/1799/2199; replace `BUNDLE_TIERS` with `BUNDLE_CHAT_DISCOUNT_GBP` + `bundleChatPriceGbp()` + `bundleTotalGbp(voiceTier, chatTier)`; keep setup-fee + `EXTRA_CALL_PRICE_GBP` (already 0.90).
- `src/lib/billing/pricing.ts`: drop `ChatChannelMode`; `CHAT_PRICE_GBP[tier]` single value; `VOICE_PRICE_GBP` new; replace `DOUBLE_DECKER_GBP` with compositional bundle helpers; retire `BAND_A`/`BAND_B`/`SETUP_FEE`/legacy band exports; keep `VOICE_PLAN_SPEC`, setup helpers, `resolveNewModelPricing` (drop `chatMode`).
- `tests/billing-pricing-drift.test.ts`: update equalities to the new figures.

### B. Marketing surfaces
- `src/components/marketing/pricing-sections.tsx`: Chat cards become single-price; Voice cards new prices; **Double Decker → interactive Mix & Match** (Voice-tier selector + Chat-tier selector → live discounted total, shows strike-through + "£X OFF"). Remove channel/bundle copy + the "bespoke / multi-channel" blurb.
- `src/app/(marketing)/pricing/page.tsx`: revamp surrounding content (two products, remove channels), keep structure.
- `src/components/marketing/roi-calculator.tsx` + `pricing-roi.tsx` + `roi.ts`: reflect Chat + Voice (missed calls answered by Voice, missed chats answered by Chat); keep the core recovered-revenue math.

### C. Billing libs / Stripe code
- `src/lib/billing/plan-price.ts`: remove legacy `buildSubscriptionCreateParams` + `setupFeeMinor`/`buildSetupInvoiceItemParams` (plan_band based); keep new-model `buildProductSubscriptionParams` + `buildNewSetupInvoiceItemParams`.
- `src/lib/billing/new-model-charges.ts`, `event-map.ts`, `handle-event.ts`: drop channel_mode / plan_band metadata; ensure chat+voice subscription split works for Mix & Match (two subs: voice full + chat discounted).
- `src/lib/billing/credit.ts` / `credit-checkout.ts` / `credit-topup.tsx`: align extra-call price to £0.90.
- `src/lib/admin/billing-math.ts`, `src/lib/admin/plan-bands.ts`: remove; replace plan-band math with commercial_model + tier.

### D. Supabase migration (MCP, prod) — pause for confirm before applying
- Snapshot `tenants`, `chat_subscriptions`, `voice_subscriptions` rows.
- Drop `chat_subscriptions.channel_mode` (+ CHECK).
- Migrate the 1 real tenant onto `commercial_model` + tier; drop `tenants.plan_band` (+ CHECK) after all reads are updated.
- Regenerate TS types if used.

### E. Admin dashboard
- `src/app/admin/plans/page.tsx` + `actions.ts`: rebuild the plans catalog around Chat / Voice / Double Decker tiers (no channels).
- `src/app/admin/tenants/new/tenant-form.tsx` + `provisioning.ts` + `actions.ts`: provisioning picks commercial_model + chat tier + voice tier (no channel_mode / plan_band).
- `[tenantId]/billing-panel.tsx`, `billing-actions.ts`, `entitlements-section.tsx`, `page.tsx`, `tenants/page.tsx`, `admin/page.tsx`, `admin/billing/page.tsx`: replace plan_band display/logic with the new model.

### F. Tenant dashboard
- `src/app/dashboard/billing/page.tsx`, `src/lib/dashboard/billing-queries.ts`, `queries.ts`, `types.ts`, `product-overview.ts`: show the tenant's chat/voice products + tiers; remove channel_mode/plan_band.
- `src/app/dashboard/chat/page.tsx`, `voice/page.tsx`, `dashboard/page.tsx`: remove multi-channel framing.

### G. Verify
- `npm run build` + `npm test` (drift + structure tests) clean.
- Screenshot marketing /pricing (desktop+mobile) and the admin/tenant billing surfaces.
- Commit.

## Sequencing
A → B/C in parallel → D (confirm) → E/F → G. The pure data layer (A) lands first so every consumer compiles against the new shape; the destructive prod migration (D) happens only after the code reads are updated and gets one explicit go-ahead.
