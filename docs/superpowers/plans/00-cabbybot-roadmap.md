# CabbyBot — Master Build Roadmap (Plan Index)

> **Source spec:** [`CabbyBot - PRD.md`](../../../CabbyBot%20-%20PRD.md) v1.0
> **Brand rule:** "n8n" must **never** appear on any customer-facing surface. Always "CabbyBot Automation Engine" or "your automation." Never "CabLab."

This is the **index** for the CabbyBot build. The PRD covers 12 epics that are independent subsystems, so each epic gets its **own** implementation plan that produces working, testable software on its own. Build them **in order** — each plan lists the earlier plan(s) it depends on.

Each plan, when written, lives in this folder as `YYYY-MM-DD-epic-N-<name>.md` and is executed with the `superpowers:subagent-driven-development` or `superpowers:executing-plans` skill.

---

## Locked product decisions (from §17 open questions)

These were confirmed before the Foundations plan and apply across all epics:

| § | Question | Decision |
|---|---|---|
| Q1 | AI/LLM token costs | **Customer brings own key** (stored in credentials vault). No usage-metering table. |
| Q3 | Currency | **Multi-currency per tenant** — `GBP`/`EUR`/`USD` per `tenants.currency`. |
| Q8 | Renewal | **Roll to monthly** after the 12-month term. `tenants.renewal_mode` default `rolling_monthly`. |

Still open (resolve at the epic that needs them, noted per-plan below): Q2 (iCabbi/Cordic stubs vs defer), Q4 (setup-fee refundability), Q5 (mid-contract upgrades/pro-rata), Q6 (demo geography), Q7 (custom domain model), Q9 (n8n editor access granularity), Q10 (brand assets), Q11 (discovery-call tool), Q12 (demo WA number).

---

## Plan sequence

### ✅ Plan 1 — Epic 1: Foundations  → `2026-05-31-epic-1-foundations.md`
**Depends on:** nothing (greenfield).
**Produces:** Next.js 15 + TS + Tailwind v4 app that builds; full Supabase schema (§8.1) + RLS (§8.2) as versioned migrations running on local Supabase; JWT custom-claims auth hook; server/browser/middleware Supabase client wrappers; `middleware.ts` route protection; zod-validated env; GitHub Actions CI (lint + typecheck + migration dry-run + tests).
**Done when:** `pnpm build` passes, `pnpm test` (schema + RLS isolation + middleware) passes, CI is green.
**Frontend skill:** not yet — no UI surfaces.

### ✅ Plan 2 — Epic 2: Marketing Site  → `2026-05-31-epic-2-marketing-site.md`  (DONE & merged to `master` 2026-06-01, HEAD `99d0607`)
**Depends on:** Plan 1.
**Decisions locked:** Discovery CTA → Cal.com (`NEXT_PUBLIC_CAL_LINK`); brand assets → #FFD400 editorial + placeholder wordmark; multi-currency pricing GBP/EUR/USD.
**Produces:** Public pages (Home, How It Works, Channels, Pricing A/B/C, Custom Solutions, Case Studies, About, Contact, Legal), `#FFD400` editorial design system, transparency section, ROI calculator, dispatch badges (AutoCab/iCabbi/Cordic), discovery-call CTA, "Try the Dashboard" → demo. **No public signup.**
**Open qs to resolve at start:** Q10 (brand assets finalised?), Q11 (Calendly/Cal.com/HubSpot).
**Frontend skill:** **use `ui-ux-pro-max`** for the design system + every page.

### ✅ Plan 3 — Epic 3: Internal Admin Console  → `2026-06-01-epic-3-admin-console.md`  (DONE & merged to `master` 2026-06-01, HEAD `20978ae`)
**Depends on:** Plans 1, 4 (auth). Built **before** the tenant dashboard.
**Produces:** Tenant provisioning form, automation registry, build queue (Kanban), Supabase `invite()` integration, channel credentials vault (Supabase Vault/`pgcrypto`), Stripe panel + renewal alerts, read-only impersonation (audit-logged, 15-min expiry), platform analytics.
**Open qs:** Q9 (n8n editor deeplink — senior eng only?).
**Frontend skill:** **use `ui-ux-pro-max`** for admin UI.

### ✅ Plan 4 — Epic 4: Auth & Invite-Only Login  → `2026-06-01-epic-4-auth-invite-login.md`  (DONE & merged to `master` 2026-06-01, HEAD `bbbaea1`)
**Depends on:** Plan 1.
**Produces:** Supabase Auth SSR + browser flows, invite → set-password flow, MFA (TOTP) enforced for Owner/Admin, login/logout/reset UI, middleware finalised (Plan 1 ships the skeleton; this completes the flows).
**Note:** Plan 1 lays the auth-hook + middleware skeleton so Plans 2–3 can be developed; Plan 4 completes user-facing auth. Can be sequenced before Plan 3 if preferred.
**Frontend skill:** **use `ui-ux-pro-max`** for auth screens.

### ✅ Plan 5 — Epic 5: Automation Engine Integration  → `2026-06-01-epic-5-automation-engine.md`  (DONE & merged to `master` 2026-06-01, HEAD `217022d`)
**Depends on:** Plans 1, 3.
**Produces:** Engine (n8n) API client (start/stop/restart/status/runs — **internal label only**), webhook gateway with channel→automation resolver (Supabase lookup cached in Upstash Redis 5-min TTL), per-channel signature verification, async forward + idempotency key, status sync into Supabase, audit logging for control-plane actions.
**Perf target:** webhook ACK p95 ≤300ms.

### ✅ Plan 6 — Epic 6: Dispatch Adapter Layer  → `2026-06-01-epic-6-dispatch-adapter-layer.md`  (DONE & merged to `master` 2026-06-02, HEAD `638b4a8`)
**Depends on:** Plan 5.
**Produces:** `DispatchAdapter` TS interface (§7.6); **AutoCab** full adapter (address/zones/capabilities/quote/booking CRUD/flights); LHR terminal zone mapping (T1/T2/T3→`LHR T123`, T4→`LHR T4`, T5→`LHR T5`); IATA→airline lookup; airport buffer logic; per-tenant adapter selection; iCabbi/Cordic stubs.
**Open qs:** Q2 (stubs that error gracefully vs defer selector).

### ✅ Plan 7 — Epic 7: Tenant Dashboard  → `2026-06-02-epic-7a-tenant-dashboard-core.md` + `2026-06-02-epic-7b-tenant-dashboard-extended.md`  (DONE & merged to `master` 2026-06-02, HEAD `9608185`)
**7a (written):** shared foundation (recharts, dashboard shell/subnav, RLS data layer, Realtime hook, shared components/charts), tenant read-API layer, and the four core sections — Org Overview, Per-Automation Overview (live feed + charts), Bookings (table + slide-over + CSV), Conversations (transcript). Design system: ui-ux-pro-max "Data-Dense Dashboard" (blue #1E40AF / amber #F59E0B, Fira Sans), persisted at `design-system/cabbybot-dashboard/`.
**7b (written):** `2026-06-02-epic-7b-tenant-dashboard-extended.md` — Analytics (10 sections, honest empty states for voice/response-time pending Epic 10), Config + Support (new tables `automation_config`/`support_tickets`, migration 0015), Channels, Team (Owner-gated service-role invite), Billing (read-only; Stripe portal/invoices stubbed for Epic 8).
**Depends on:** Plans 1, 4, 5, 6.
**Produces (in PRD order of complexity):** (1) Org overview grid + Realtime; (2) Per-automation overview + live feed; (3) Bookings table + filters + CSV + slide-over; (4) Conversations + transcript; (5) Analytics (10 sections, recharts); (6) Bot config; (7) Channels; (8) Team; (9) Billing; (10) Support.
**Realtime rule:** one Realtime channel per automation view, auto-unsubscribe on unmount; never org-wide.
**Perf target:** dashboard p95 ≤1.5s warm.
**Frontend skill:** **use `ui-ux-pro-max`** throughout — this is the largest UI surface. Consider splitting into 7a (overviews + bookings + conversations) and 7b (analytics + config + channels + team + billing + support) when the plan is written.

### ✅ Plan 8 — Epic 8: Stripe Billing  → `2026-06-02-epic-8-stripe-billing.md`  (DONE & merged to `master` 2026-06-02, HEAD `692a279`)
**Depends on:** Plans 1, 3.
**Produces:** Setup-fee one-time invoice on contract-signed; monthly subscription on go-live (billing start = go-live date); Stripe Tax (UK VAT); Customer Portal session API; webhook handlers (`customer.subscription.*`, `invoice.payment_failed` → Resend to ops + customer, no auto-suspend; `invoice.paid` → log). Honour `renewal_mode = rolling_monthly`.
**Open qs resolved (2026-06-02):** Q4 — setup fee **non-refundable, manual-only** (no refund code). Q5 — mid-contract upgrades **deferred, admin-driven** (no proration endpoint; staff change subs in Stripe, webhook syncs mirror).
**Plan written (8 tasks):** Stripe SDK + lazy singleton; pure modules (pricing→Stripe params, date math, event→mirror map, payment-failed email template, `handleStripeEvent` orchestrator); `/webhooks/stripe` route (raw-body verify + Redis `claimOnce` idempotency); admin setup-fee/subscription/sync actions + tenant-detail controls; live Customer Portal session (replaces Epic-3 503 stub). All Stripe I/O confined to `src/lib/billing/**`; new Resend sender in `src/lib/email/**`. No new migration (0004 `subscriptions`/`setup_fees` + 0001 `stripe_customer_id` already suffice).

### ✅ Plan 9 — Epic 9: Demo Tenant  → `2026-06-02-epic-9-demo-tenant.md`  (DONE & merged to `master` 2026-06-02, HEAD `d3e5587`)
**Depends on:** Plans 1, 7.
**Produces:** Supabase seed script (6 months deterministic mock data — bookings ASAP/Scheduled/Airport, voice/location/bilingual/manage/cancel conversations, all analytics populated, 3 automations); one-click `/demo` read-only session pinned to `DEMO_TENANT_ID`; read-only enforcement (writes → 403 + banner); 24h reset via Supabase Edge Function cron.
**Open qs:** Q6 (UK-only vs international demo geography).

### ✅ Plan 10 — Epic 10: Voice Pipeline Integration  → `2026-06-02-epic-10-voice-pipeline.md`  (DONE & merged to `master` 2026-06-02, HEAD `faf2d77`)
**Depends on:** Plans 5, 7.
**Produces:** `WA Voice Booking Processor` sub-workflow wired to WhatsApp automations (Whisper transcribe → GPT slot extraction → merge at intent router); dashboard conversation view renders transcript + extracted slots; voice analytics section; Whisper language auto-detect → `conversations.language`.
**Perf target:** voice note → reply p95 ≤8s.

### ✅ Plan 11 — Epic 11: Observability & QA  → `2026-06-02-epic-11-observability-qa.md`  (DONE & merged to `master` 2026-06-02, HEAD `b7a8cf3`)
**Depends on:** Plans 5, 7.
**Produces:** OpenTelemetry in route handlers + engine; Grafana Cloud dashboards (latency, error rate, webhook throughput, dispatch latency per adapter); Sentry (frontend + server); Playwright E2E (text + voice booking, manage booking, admin provisioning, demo tenant); webhook load test @100 concurrent.

### ✅ Plan 12 — Epic 12: Launch Readiness  → `2026-06-03-epic-12-launch-readiness.md`  (DONE & merged to `master` 2026-06-03, HEAD `ef07528`)
**Depends on:** all prior.
**Produces:** Legal pages (Privacy, Terms, DPA, Cookie Policy); status page; live demo WhatsApp number; sales collateral; ops runbook (provisioning SOP, credential rotation, incident response).
**Open qs:** Q12 (demo WA number budget + sandbox vs mock).

---

## Advanced feature program (post-launch — Epics 13+)

> Triggered by the "advanced tenant + admin dashboard features" initiative. Each advanced feature gates on the entitlement/metering foundation below.

### ✅ Plan 13 — Epic 13: Entitlements & Metering Foundation  → `2026-06-03-epic-13-entitlements-metering.md`  (DONE on branch `feat/epic-13-entitlements-metering`, HEAD `23263e9`; not yet merged)
**Depends on:** Plans 1 (schema/RLS), 3 (admin console).
**Produces:** migrations 0017 (plans/features/plan_features/tenant_entitlements/feature_rollouts + `tenants.plan_id`) + 0018 (append-only `usage_events` + `usage_counters`) + 0019 (RLS hardening); `src/lib/entitlements/*` (catalog, pure merge, cached resolver, metering, `requireFeature`/`requireQuota` guards mirroring `blockIfDemo`); admin `/admin/plans` packaging editor + per-tenant override section; idempotent `scripts/seed-entitlements.ts` (16 features, Starter/Pro/Enterprise plans). 29 unit/migration tests + final review (anon catalog exposure closed, override inherit path, counter-period limitation documented).
**Supersedes:** locked decision **Q1** ("no usage-metering table") — metering is now required to gate/bill advanced features.

### ✅ Plan 14 — Epic 14: Alerting & Notifications  → `2026-06-03-epic-14-alerting.md`  (DONE & merged to `master`, HEAD `4fd6ca6`)
**Depends on:** Plan 13 (entitlements), 7 (insight metrics), 9 (`blockIfDemo`).
**Produces:** migration 0020 (`alert_rules`, `notification_channels`, append-only `alert_events` + `notification_log`); `src/lib/alerting/*` (pure evaluate, metric registry, dispatch→send/log/meter, evaluation engine, queries); tenant API `/api/orgs/:id/alerts/{rules,channels,evaluate}` gated by `requireFeature("alerting")` + `blockIfDemo`; entitlement-gated `/dashboard/alerts` page + nav. Meters the `notifications` unit. 15 tests; final review fixes (dispatch never-throws, empty alert-event-id guard, demo-block evaluate).
**v1 follow-ups:** event ack/resolve (append-only trigger blocks it); per-rule re-fire cooldown; `requireQuota` pre-check on send; platform cron calling the evaluate route per tenant.

### ✅ Plan 15 — Epic 15: Customer CRM + Data Governance  → `2026-06-04-epic-15-crm.md`  (DONE & merged to `master`, HEAD `a0385ae`)
**Depends on:** Plan 13 (entitlements), 9 (`blockIfDemo`), 1/7 (bookings/conversations).
**Produces:** migration 0021 (`customers` per tenant+handle, `customer_notes`, `customer_id` FKs on bookings/conversations); `src/lib/crm/*` (pure stats aggregation, `syncCustomers` derive-from-bookings, queries incl. DSAR export/delete); gated tenant API (`/api/orgs/:id/customers/*` incl. DSAR Owner-only) + `/dashboard/customers` page (list, VIP/blocklist flags). DSAR delete erases ALL PII (dispatch JSON + message payloads/transcripts) and writes `audit_log`. 12 tests; review fixes applied.
**v1 follow-ups:** backfill `bookings/conversations.customer_id` (sync matches by handle today); per-customer detail-drill UI (API exists); make DSAR delete a single Postgres transaction (currently ordered scrubs with error aggregation).

### ⏭ Planned Epics 16–24 (one plan each, dependency order; each gates via `requireFeature`):
16 Bot config control plane (versioning/fare rules/guardrails) · 17 Live ops & human takeover · 18 Dispatch & fulfilment ops · 19 Conversation intelligence · 20 Account invoicing & finance · 21 Reporting & white-label · 22 Self-serve channels · 23 Benchmarking/governance/integrations/API · 24 AI copilot.

---

## Cross-cutting rules every plan must honour

- **Multi-tenancy:** every business table has `tenant_id`; automation-scoped tables also carry `automation_id`. RLS enforces isolation at the DB layer (§8.2).
- **Brand language:** never expose "n8n"/"workflow"/"execution"/"CabLab" on customer surfaces — use the §18.1 substitution table.
- **Auth:** public signup disabled; all accounts via admin `invite()`; MFA for Owner/Admin; JWT claims `{ tenant_id, role, is_flowmo_staff, automation_restrictions[] }`.
- **Data residency:** UK/EU regions only.
- **Perf budgets:** §11 targets are acceptance criteria, not aspirations.
- **TDD + frequent commits:** every plan is bite-sized, test-first, commit-per-task.
