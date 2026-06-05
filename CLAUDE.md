# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Think Before Coding

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so.
- If something is unclear, stop and ask.

## Simplicity First

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.

## Surgical Changes

Touch only what you must. Every changed line should trace directly to the user's request. When your changes create orphaned imports/variables, remove them — but don't touch pre-existing dead code.

---

## Project: BookMyCab by FlowMo AI LTD

AI automation platform for cab/taxi companies. Every customer gets a **bespoke** omnichannel booking bot — never a template clone. Admin-provisioned only (no public signup).

**Critical language rule:** n8n must **never** appear on any customer-facing surface. Always say "BookMyCab Automation Engine" or "your automation." Never say "CabLab" — always "BookMyCab."

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 |
| Auth | Supabase Auth — invite-only (`DISABLE_SIGNUP=true`); JWT claims include `tenant_id`, `role`, `is_flowmo_staff` |
| Database | Supabase (PostgreSQL 15) with Row Level Security on all tenant-scoped tables |
| Realtime | Supabase Realtime — live booking feed + automation status on dashboard |
| Automation engine | n8n (self-hosted, queue mode, one project per tenant) — **internal only** |
| Session state | n8n Data Tables (`taxi_sessions`) — operational state machine, not analytics |
| Cache/Queue | Redis + BullMQ via Upstash — webhook fan-out, async dispatch calls |
| Email | Resend |
| Payments | Stripe Billing + Stripe Tax |
| Charts | recharts |
| Observability | OpenTelemetry → Grafana Cloud + Sentry |
| Infra | Vercel (Next.js) + Hetzner (n8n + Redis) + Supabase + Cloudflare |

---

## Architecture Overview

```
Customer Channels (WhatsApp/Telegram/Messenger/Instagram/Widget)
  ↓ webhooks
Next.js Edge Gateway (/webhooks/:channel/:automationId)
  - Signature verify → lookup automation_id → forward to n8n
  - Returns 200 immediately; n8n processes async
  ↓
n8n Automation Engine (internal, never exposed)
  - One project per tenant; one workflow per automation
  - Booking state machine stored in n8n Data Tables (taxi_sessions)
  - Calls dispatch adapter (AutoCab v1; iCabbi/Cordic v1.2 stubs)
  - Writes confirmed bookings to Supabase via REST API
  ↓
Supabase (PostgreSQL + RLS)
  - Bookings INSERT triggers Supabase Realtime → dashboard live feed
  ↓
Next.js Dashboard (/dashboard → /dashboard/automations/[automationId]/*)
```

### Multi-tenancy

- Every business table has `tenant_id`; automation-scoped tables also carry `automation_id`.
- RLS enforces `tenant_id = auth.jwt()->'tenant_id'` on all reads/writes.
- A channel is bound to exactly one automation. An automation can have multiple channels.
- A tenant can run multiple parallel automations (Booking, Support, Driver, Custom).

### Booking State Machine (`taxi_sessions` Data Table)

One row per active phone number per automation. The `step` field drives the state machine. Key states:

```
welcome → awaiting_intent → [book flow | airport flow | manage flow]

Book flow: awaiting_time_mode → awaiting_pickup → resolving_pickup_* →
           awaiting_destination → awaiting_vehicle → awaiting_name →
           awaiting_contact_number → awaiting_quote_confirm → confirmed_booking

Airport flow: awaiting_airport_flight → awaiting_airport_time → ... → confirmed_booking

Manage flow: manage_booking → awaiting_manage_selection → [cancel | modify | change]
```

Voice notes (`messageType=audio`) are routed to the `WA Voice Booking Processor` sub-workflow (Whisper transcription → GPT slot extraction) then merged back into the main state machine at the intent router.

### Dispatch Adapters

Common `DispatchAdapter` interface across all three systems. Selected per-tenant at provisioning time via `tenants.dispatch_adapter`.

- **AutoCab** (v1, primary): subscription key + `companyId`; synchronous REST; full CRUD + flight lookup. LHR terminal zones: T1/T2/T3 → `LHR T123`, T4 → `LHR T4`, T5 → `LHR T5`.
- **iCabbi** (v1.2 roadmap): async booking confirmation via polling; fare ranges normalised to single price.
- **Cordic** (v1.2 roadmap): SOAP/REST hybrid.

---

## Key API Routes

### Webhook Gateway (channel inbound)
```
GET/POST /webhooks/whatsapp/:automationId
GET/POST /webhooks/telegram/:automationId
GET/POST /webhooks/messenger/:automationId
GET/POST /webhooks/instagram/:automationId
POST     /webhooks/widget/:automationId
POST     /webhooks/stripe
```

### Tenant API
```
GET/POST /api/orgs/:orgId/automations
POST     /api/orgs/:orgId/automations/:automationId/start|stop|restart
GET      /api/orgs/:orgId/automations/:automationId/status|runs
GET      /api/orgs/:orgId/automations/:automationId/bookings[/:bookingId]
GET      /api/orgs/:orgId/automations/:automationId/conversations[/:id/messages]
GET      /api/orgs/:orgId/automations/:automationId/analytics/*
GET/PATCH /api/orgs/:orgId/automations/:automationId/config
GET      /api/orgs/:orgId/automations/:automationId/channels
POST     /api/orgs/:orgId/team/invite
GET      /api/orgs/:orgId/billing/subscription|invoices
POST     /api/orgs/:orgId/billing/portal
```

### Admin API (FlowMo staff only, `is_flowmo_staff=true` in JWT)
```
/admin/api/tenants
/admin/api/automations
/admin/api/build-queue
/admin/api/platform/analytics
/admin/api/impersonate
```

---

## Auth Rules

- Public signup disabled. All accounts created via Supabase `invite()` by FlowMo admin.
- JWT claims: `{ tenant_id, role, is_flowmo_staff, automation_restrictions[] }`
- MFA enforced for Owner and Admin roles.
- `middleware.ts` validates JWT, enforces `tenant_id` matches `:orgId` in URL, blocks `/admin/*` without `is_flowmo_staff`.
- Impersonation (admin only): read-only, 15-minute auto-expiry, mandatory reason field, fully audit-logged.

---

## Data Model Key Points

- `tenants.dispatch_adapter` controls which adapter the automation uses.
- `channels.credentials_ref` is a vault reference — raw credentials never appear in responses.
- `audit_log` is append-only; tenant users have no SELECT; only `service_role`/FlowMo admin can read it.
- `conversations.outcome`: `booked | quoted | abandoned | managed | cancelled | unknown`
- `bookings.status`: `confirmed | dispatched | completed | cancelled | no_show`
- `automations.status`: `building | uat | live | stopped | error`
- Demo tenant rows have `is_demo = true`; demo users get a read-only Supabase session pinned to `DEMO_TENANT_ID`.

### n8n → Supabase Write Contract

After a confirmed booking, n8n posts to `POST /rest/v1/bookings`. Required fields include `tenant_id`, `automation_id`, `conversation_id`, `dispatch_ref`, `dispatch_adapter`, and the full address JSON objects. `raw_dispatch_json` stores the full dispatch response for audit.

---

## Dashboard Structure

```
/dashboard                                    — Org overview (all automations grid)
/dashboard/automations/[id]                   — Per-automation overview + live feed
/dashboard/automations/[id]/bookings          — Booking table + slide-over detail
/dashboard/automations/[id]/conversations     — Transcript viewer
/dashboard/automations/[id]/analytics         — 10-section recharts analytics
/dashboard/automations/[id]/config            — Bot configuration (editable by Owner/Admin)
/dashboard/automations/[id]/channels          — Channel health + token expiry
/dashboard/team                               — Invite, roles, automation restrictions
/dashboard/billing                            — Stripe portal + invoice history
/dashboard/support                            — Ticket form
/admin                                        — FlowMo staff only
/demo                                         — One-click read-only demo session
```

Realtime subscriptions: one channel per automation dashboard view, auto-unsubscribed on unmount. Never subscribe at org level for all automations simultaneously.

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
N8N_BASE_URL=                       # internal only, never exposed to customers
N8N_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@bookmycab.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
WEBHOOK_RATE_LIMIT_PER_MIN=60
DEMO_TENANT_ID=
FLOWMO_STAFF_EMAIL_DOMAIN=flowmoai.com
```

---

## Build Order (Epics)

Build in this order — later epics depend on earlier ones:

1. **Foundations** — Next.js + Supabase schema + RLS + Auth + CI/CD
2. **Marketing Site** — public pages, no signup, all CTAs → discovery call
3. **Internal Admin Console** — tenant provisioning, build queue, Stripe panel, impersonation
4. **Auth + Invite Flow** — Supabase Auth SSR, middleware, MFA
5. **Automation Engine Integration** — n8n API client, webhook gateway, Redis cache
6. **Dispatch Adapter Layer** — AutoCab full; iCabbi/Cordic stubs
7. **Tenant Dashboard** — all 10 sections in order of complexity
8. **Stripe Billing** — setup fee + subscription + webhooks
9. **Demo Tenant** — seed script + 24h reset cron + read-only enforcement
10. **Voice Pipeline** — WA Voice Processor sub-workflow + dashboard transcript view
11. **Observability** — OTel + Grafana + Sentry + Playwright E2E
12. **Launch Readiness** — legal pages, status page, demo WA number

---

## Performance Targets

| Metric | Target |
|---|---|
| Webhook ACK | p95 ≤ 300ms |
| Message → bot reply | p95 ≤ 3s |
| Voice note → reply | p95 ≤ 8s |
| Dashboard page load | p95 ≤ 1.5s |
| API route handler | p95 ≤ 200ms |
