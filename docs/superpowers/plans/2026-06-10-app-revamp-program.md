# App Revamp — Two-Product Platform Program Plan

> **STATUS: PROGRAM OUTLINE — NOT YET EXECUTION-READY.** This is a high-level decomposition with **open decisions marked `🔶 DECISION`**. Unlike the pricing plan, this is NOT bite-sized TDD because the schema, Stripe metering, and coupon models are undefined. **Each epic below must be brainstormed (`superpowers:brainstorming`) into its own spec, then planned with `writing-plans`, before any code is written.** Do not hand this document to a coding subagent as-is.

**Goal:** Re-platform the tenant and admin dashboards around **two products** — multi-channel **Chat** and **AI Voice Agent** — removing the legacy n8n-workflow-derived dashboard surfaces, and adding call-credit metering, billing, coupons, and per-agent analytics.

**Why this is a program, not a plan:** It spans Supabase schema, RLS, billing/Stripe, metering, coupons, two dashboards, and analytics. Per the writing-plans Scope Check, multi-subsystem specs must be split so each produces working, testable software on its own. There are also ~30 existing epic plans in `docs/superpowers/plans/` whose features this revamp partly **removes** — that reconciliation is itself a design task.

---

## 1. Product model (the new shape)

```
Organisation (tenant)
 ├── Chat product
 │    └── Channels (WhatsApp / Messenger / Instagram / Telegram / Web Widget)
 │         - one bot, many channels; tier by fleet size
 └── AI Voice product
      └── Voice Agents (1..N)
           - each agent = phone number(s) + monthly call allowance
           - call credits: fresh monthly, NO carry-forward, 30-day expiry
           - top-up credit: £0.90 / call, min £9 purchase
```

A tenant dashboard must show, at a glance: number of Chat channels in use, number of AI Voice agents in use, phone numbers in use (chat + voice), calls made this period, and remaining calls per plan.

✅ **DECISION D1 — n8n boundary. RESOLVED 2026-06-10.**
- **The n8n engine STAYS.** Keep the engine libs (`src/lib/engine/client.ts`, `engine/control.ts`, `engine/types.ts`) — they are reused for Voice, not deleted.
- **Chat loses ALL engine affordances in both dashboards (tenant + admin):** no start/stop/restart buttons, no status/runs feed, no admin engine deep-links. Chat just runs; it is managed internally and the dashboard reads only Supabase for it.
- **Voice KEEPS engine controls:** start/stop (and status) buttons remain **for AI Voice agents only**. A new, Voice-specific n8n workflow will be built and wired later; its nodes drive **call volume, analytics, and credit usage**. That wiring is a later epic (see R3/R5) — this revamp just preserves the control surface for Voice.

Net effect: this is a **surgical UI change + product-gating**, not an engine replacement. Engine control routes/libs are retained but rendered **conditionally by product kind** (`voice` → controls shown, `chat` → controls hidden).

---

## 2. Removal / migration manifest (D2 — RESOLVED 2026-06-10)

✅ Grounded in a full route audit. Given D1, the blast radius is small: almost everything is **KEEP** or **MIGRATE** (reshape for the two-product model); the only hard removals are **Chat's** engine-control affordances. Engine control **API routes and libs are KEPT** because Voice reuses them.

**Legend:** KEEP = unchanged · MIGRATE = reshape for two-product model · GATE = keep but render only for `voice` · DELETE = remove from UI.

### Engine control (the only n8n-derived surfaces)
| Surface | Action |
|---|---|
| `lib/engine/client.ts`, `engine/control.ts`, `engine/types.ts` | **KEEP** — reused by Voice |
| `api/.../automations/[id]/start\|stop\|restart\|status\|runs/route.ts` | **KEEP** routes; **GATE** at UI to `voice` products only |
| Chat product overview: start/stop/restart buttons, status badge, runs feed | **DELETE** (Chat has no engine UI) |
| Voice agent overview: start/stop + status | **GATE** (shown only for Voice) |
| `admin/automations/page.tsx` + `lib/admin/engine-links.ts` (n8n deep-links) | **MIGRATE** — engine links shown for Voice agents only; removed for Chat |
| `lib/liveops/relay.ts` (references n8n) | **MIGRATE** — verify it serves human-takeover relay independent of Chat engine controls; decouple if it surfaces Chat run state |

### Tenant dashboard pages — all KEEP or MIGRATE
| Page | Action | Note |
|---|---|---|
| `dashboard/page.tsx` | **MIGRATE** | Org overview → two-product summary: # chat channels, # voice agents, phone numbers in use, calls made, remaining calls |
| `automations/[automationId]/page.tsx` | **MIGRATE** | Becomes Chat-product OR Voice-agent overview by `kind`; engine controls gated to Voice |
| `.../analytics` | **MIGRATE** | Chat analytics by channel; Voice analytics per-agent + one aggregate (R5) |
| `.../bookings`, `.../conversations`, `.../channels`, `.../config`, `.../fares`, `.../versions` | **KEEP** | Supabase-sourced; not n8n-derived. `versions` = bot-config history, not engine runs |
| `alerts`, `billing`, `connect`, `copilot`, `customers`, `dispatch`, `integrations`, `intel`, `invoicing`, `liveops`, `reports`, `support`, `team` | **KEEP** | `billing` EXTENDED for credit top-up + coupons (R3/R4) |

### Admin pages — all KEEP or EXTEND
| Page | Action | Note |
|---|---|---|
| `admin/automations` | **MIGRATE** | Engine links → Voice only |
| `admin/coupons` | **KEEP/EXTEND** | Coupon management already exists — extend per R4 (create/print/manage) |
| `admin/plans`, `admin/billing`, `admin/usage` | **EXTEND** | Wire plan tiers to new pricing; usage shows call volume (R7) |
| `admin/tenants`, `tenants/new`, `tenants/[tenantId]` | **EXTEND** | Provisioning now creates Chat product + N Voice agents (R6) |
| `admin/build-queue`, `credentials`, `channel-review`, `guardrails`, `health`, `benchmarks`, `platform`, `rollouts`, `impersonate` | **KEEP** | Platform ops, not n8n-Chat-coupled |

**No hard deletions of whole pages.** The destructive change is limited to removing Chat's engine-control affordances and gating those controls to Voice. Get sign-off on this manifest before editing, but it requires no mass route deletion.

---

## 3. Recommended epic sequence

Build in this order; later epics depend on earlier ones. Each is a separate brainstorm → spec → plan.

### Epic R1 — Schema & RLS for the two-product model
New/changed Supabase tables (sketch — finalise in the R1 spec):

```
products            (tenant_id, kind: 'chat'|'voice', status)         -- one row per product a tenant runs
chat_channels       (tenant_id, product_id, channel_type, phone_or_handle, status)
voice_agents        (tenant_id, product_id, name, phone_number, plan_tier, status)
call_credits        (tenant_id, voice_agent_id|null, period_start, period_end,
                     allowance, used, source: 'plan'|'topup', expires_at)
calls               (tenant_id, voice_agent_id, started_at, duration_s, outcome, credit_charged)
coupons             (code, kind: 'percent'|'amount', value, currency, max_redemptions,
                     redeemed_count, valid_from, valid_to, created_by_admin, status)
coupon_redemptions  (coupon_id, tenant_id, applied_at, invoice_ref)
```

- RLS: `tenant_id = auth.jwt()->'tenant_id'` on all tenant-scoped tables; coupons readable by tenant only for *validation at checkout*, fully managed by admin only.
- 🔶 **DECISION D3 — credit ledger model.** Per-agent credit pools vs one org-wide pool with per-agent attribution. Spec says "split analytics per agent + one main analytics for all agents," which implies per-agent attribution at minimum. Decide whether *allowance* is per-agent or per-org.
- 🔶 **DECISION D4 — monthly reset mechanics.** "New month, new fresh credits, no carry-forward, 30-day expiry." Driven by a Supabase cron (pg_cron) or a Stripe billing-cycle webhook? Define the reset job and the expiry rule precisely (calendar month vs rolling 30 days — the spec says both "new month" and "30 days"; reconcile).

### Epic R2 — Product-kind gating + Chat engine-UI removal
Per the resolved §2 manifest (not a data re-plumb — Chat already reads Supabase):
- Introduce product `kind` (`chat` | `voice`) on the automation/product entity (R1) and **gate** the engine-control affordances (start/stop/restart/status/runs, admin engine-links) to `voice` only.
- **Remove** those affordances from the Chat product overview and admin automations view.
- Reshape `dashboard/page.tsx` and `automations/[automationId]/page.tsx` for the two-product model.
- Keep all engine routes/libs intact (Voice reuses them).

### Epic R3 — Call-credit metering & top-up
- Meter `calls` → decrement `call_credits.used`; block/flag when allowance exhausted.
- Top-up purchase: £0.90/call, **minimum £9** (≈10 calls). Stripe payment → credit grant.
- 🔶 **DECISION D5 — Stripe metering approach.** Stripe usage-based billing / metered price vs prepaid credit balance the app manages itself (recommended: app-managed prepaid balance, Stripe only for the purchase). Per-call (not per-minute) billing unit.

### Epic R4 — Billing & coupons
- Tenant billing page: plan, invoices (Stripe portal), apply coupon at checkout/purchase.
- Admin: **create/print/manage** coupons (tenant can only *apply*, not create).
- 🔶 **DECISION D6 — "print coupon".** Define what "Admin can Print coupon" means concretely (PDF voucher? printable code sheet?) and the coupon ↔ Stripe coupon/promotion-code mapping.

### Epic R5 — Multi-agent analytics
- Tenant analytics: per-voice-agent breakdown **plus** one aggregate "all agents" view. Chat analytics by channel.
- Voice KPIs: calls made, phone numbers in use, remaining calls vs plan, credit balance/expiry, outcomes.
- Reuse `recharts` (already in stack). 🔶 **DECISION D7 — analytics source of truth** (live aggregate queries vs a rollup table) given the existing benchmarking/reporting epics (21, 28).

### Epic R6 — Admin console enrichment
- Keep invite-only provisioning (no public signup — already enforced via `DISABLE_SIGNUP`/middleware).
- Admin adds a company + creates its login (existing flow), now also provisions Chat product + N Voice agents, assigns plan tiers, and manages coupons.

### Epic R7 — Pricing → entitlements wiring
Connect the marketing pricing tiers (from `2026-06-10-pricing-revamp.md`) to actual plan entitlements: a Chat tier sets channel limits; a Voice tier sets monthly call allowance + agent/number count; Double Decker provisions both. Reconcile with existing entitlements/metering epic 13.

---

## 4. Cross-cutting constraints (carry into every epic spec)

- **Invite-only**: no public signup; admin-provisioned accounts only (CLAUDE.md auth rules).
- **RLS on every tenant-scoped table**; `audit_log` append-only.
- **Language rule**: "n8n" never appears on any customer-facing surface — say "BookMyCab Automation Engine."
- **Currency**: GBP/EUR/USD with GBP canonical; reuse the live-FX approach from the pricing plan for any money shown in-app.
- **Demo tenant**: keep read-only demo session behaviour intact through the migration.
- **Design**: Neo-Brutalism per `globals.css`; run frontend work through the `impeccable` skill.

---

## 5. Immediate next action

D1 and D2 are **RESOLVED** (2026-06-10). Remaining gates are the schema/billing decisions D3–D7. Next step:

1. Run `superpowers:brainstorming` on **Epic R1 (schema)** first — resolve **D3** (credit ledger: per-agent vs per-org pool) and **D4** (reset/expiry mechanics: reconcile "new month" vs "30-day expiry"). R1 unblocks R2–R7.
2. Then brainstorm R3/R4 to resolve **D5** (Stripe metering: app-managed prepaid balance recommended) and **D6** ("print coupon" definition).
3. Produce a per-epic spec, then a per-epic `writing-plans` plan with bite-sized TDD tasks.

Still open: **D3, D4, D5, D6, D7** (all schema/billing/analytics design — see inline markers).

---

## Self-Review

**Spec coverage (app-changes section):**
- Remove old n8n-derived dashboard features → §2 + Epic R2 (gated by D1/D2) ✓
- Two products (Chat multi-channel + AI Voice) → §1 product model + R1 schema ✓
- Revamp tenant + admin dashboards + Supabase schema → R1, R2, R6 ✓
- Show #chat channels + #voice agents + phone numbers + calls + remaining calls → R5 analytics + R2 dashboard ✓
- Call credits fresh monthly, no carry-forward, 30-day expiry → R1 `call_credits` + D4 ✓
- Add-credit, £0.90/call, per-call not per-minute, min £9 → R3 + D5 ✓
- Billing + coupons (admin create/print/manage, tenant apply only) → R4 + D6 ✓
- Multi-agent analytics: per-agent split + one aggregate → R5 + D7 ✓
- Keep invite-only admin provisioning → R6 + §4 ✓

**Open-decision honesty:** 7 decisions (D1–D7) are explicitly flagged rather than silently invented — consistent with the writing-plans "No Placeholders" rule (better to mark a decision than fabricate a schema).
