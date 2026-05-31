# Product Requirements Document (PRD)

# CabbyBot — AI Automation Platform for the Cab Booking Industry

**Brand:** CabbyBot by FlowMo AI LTD
**Made in:** United Kingdom 🇬🇧
**Document version:** 1.0
**Date:** 31 May 2026
**Status:** Production build — approved for kickoff

---

## 1. Executive Summary

CabbyBot is a **bespoke AI automation service** for cab, taxi, and private-hire companies worldwide. Every customer receives a **fully customised** AI booking bot, support solution, and operational dashboard built to their exact specifications — not cloned from a generic template.

What each customer gets:

1. **Bespoke omnichannel AI booking bot** across their chosen channels (WhatsApp, Telegram, Facebook Messenger, Instagram DM, on-site AI Chat widget).
2. **Custom-built automations** — pricing, vehicle rules, service area, languages, brand voice, dispatch logic, edge-case handling — all coded individually per company.
3. **Multiple parallel automations per organisation** — e.g. one for bookings, one for support, one for driver comms. Each automation has its **own dashboard view and analytics**, isolated and independently controlled.
4. **Branded operational dashboard** for the cab company — visualises live activity from every running automation with **per-automation start/stop control**.
5. **Transparent fee structure** — CabbyBot charges only for platform + setup. The customer connects their own channel numbers and credentials and pays channel/API costs directly. They own their customer base.

The platform is **admin-provisioned only** — there is no public self-serve signup. FlowMo's team onboards every customer manually after sales engagement.

> **Internal note:** The automation engine is implemented on top of **n8n** (self-hosted, multi-tenant, one project per customer). n8n must **never** appear on any customer-facing surface — public copy, dashboards, emails, and marketing must refer to it as "the **CabbyBot Automation Engine**" or simply "your automation."

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Deliver **bespoke** AI automation to cab companies globally — every solution is individually built, not template-cloned.
- Support **multiple parallel automations per customer** — a single organisation can run a Booking Bot, a Support Bot, and a Driver Bot simultaneously, each with its own isolated dashboard.
- Provide a **transparent, customer-controlled fee model** — the customer brings their own channel accounts, pays channel/API costs directly, and leaves with their full customer base if they ever cancel.
- Integrate with **AutoCab** as the primary dispatch system, with a modular adapter for **iCabbi** and **Cordic** in v1.2.
- Generate predictable recurring revenue via a **subscription + one-time setup fee + 12-month contract** model.
- Operate from the UK with global customer reach.

### 2.2 Non-Goals (v1)

- **No public self-serve signup.** All accounts are admin-created and admin-invited.
- **No master template or one-size-fits-all bot.** Every customer's automation is bespoke.
- Native driver or rider mobile app (we integrate with dispatch; we don't replace it).
- Building our own dispatch/scheduling engine.
- Processing payments for rides (that is the cab company's existing arrangement).

---

## 3. Brand & Positioning

| Attribute | Value |
|---|---|
| Product name | **CabbyBot** |
| Legal entity | FlowMo AI LTD |
| Country of origin | United Kingdom 🇬🇧 |
| Tagline | "Your cab company. On every channel. On autopilot." |
| Sub-tagline | "Bespoke AI booking & support automations for the global taxi industry." |
| Tone | Confident, technical-but-friendly, transparent, no hype |
| Visual direction | Editorial — black/white base, accent yellow `#FFD400` (cab livery), modern serif headlines, geometric sans body |
| Public-facing engine label | "CabbyBot Automation Engine" (never "n8n") |
| Transparency promise | "You bring your numbers. You own your customer base. We never hold you hostage." |

---

## 4. User Personas

### 4.1 Primary — "Raj", Cab Company Operations Manager

- 35–55, runs a fleet of 10–500 vehicles in the UK, EU, GCC, or South Asia.
- Uses AutoCab, iCabbi, or Cordic dispatch.
- Wants bookings captured 24/7 across every channel his customers use (WhatsApp, phone, web).
- Wants a dashboard he can check once a day, not a system he has to maintain.

### 4.2 Secondary — "Sara", Customer Experience Lead

- Monitors multiple parallel automations (booking bot + support bot) for the same company.
- Needs separate analytics per automation to see what is converting and what is failing.
- Occasionally adjusts bot copy or opening hours directly in the dashboard.

### 4.3 Tertiary — FlowMo Internal Team

- **CabbyBot Admin (FlowMo Ops):** provisions tenants, creates organisations, sets up automations, manages billing.
- **CabbyBot Solution Engineer:** builds bespoke automations per customer brief, deploys them to the engine, wires channel credentials.
- **CabbyBot Sales:** handles discovery calls, scopes requirements, prices them into Option A/B/C/Custom.

---

## 5. Product Scope

### 5.1 Customer-Facing Offering

| Capability | Detail |
|---|---|
| **Bespoke booking bot** | Custom per customer: vehicles, service area, pricing logic, brand voice, languages — individually built |
| **Voice note support** | WhatsApp voice notes transcribed via Whisper, intent extracted via GPT, slotted into the same booking state machine as text |
| **Channel choice** | WhatsApp Business Cloud, Telegram, Messenger, Instagram DM, on-site AI Chat widget — customer picks any combination |
| **Booking modes** | ASAP, Scheduled, Airport pickup with live flight tracking and terminal-aware zone routing |
| **Real-time quote & confirm** | Quote fetched from the connected dispatch (AutoCab v1); price, ETA, and vehicle type confirmed with the customer before booking |
| **Booking management** | Customer can view, modify, or cancel existing bookings directly in the chat |
| **Multiple automations** | One organisation can run multiple independent automations (booking, support, driver, lost property, etc.), each with its own dashboard, analytics, and start/stop control |
| **Add-on automations** | Support Bot, Driver Solution, Custom Workflows — scoped and priced on demand |
| **Multilingual** | Built per customer's market — English plus any languages their customers actually speak |
| **Custom branding** | Bot fully reflects the company's name, logo (in rich cards), tone, opening hours, and service area |

### 5.2 Customer-Owned Channel Credentials (Transparency Principle)

CabbyBot does **not** supply phone numbers, bot tokens, or channel accounts. The customer:

- Connects their **own** WhatsApp Business number, Telegram bot, Meta page, etc.
- Pays **channel/API fees directly** to Meta, Telegram or their telco.
- Owns and controls their customer base. If they ever leave CabbyBot, they take their numbers and contacts — nothing is held hostage.

CabbyBot provides documentation, setup guides, and hands-on assistance during onboarding to connect each channel.

### 5.3 Tenant Dashboard (Per Organisation)

| Section | What it shows |
|---|---|
| **Overview** | All automations for this org — name, type, status, today's activity, 24h conversion |
| **Per-automation dashboard** | Click an automation → its dedicated dashboard; all metrics and controls scoped to that single automation |
| **Workflow control** | Start / Stop / Restart per automation; health indicator; last 50 runs with status and duration |
| **Bookings** | Searchable table — date, channel, customer, pickup, destination, fare, status, dispatch reference; full transcript drill-down; CSV export |
| **Conversations** | All chat sessions; transcript; parsed intent state; captured booking fields; outcome |
| **Analytics** | Conversion funnel, channel mix, top pickup zones, peak-hour heatmap, abandonment reasons, period-over-period comparison |
| **Channels** | Per-channel status, token health warnings, "Send test message", reconnect flow |
| **Bot configuration** | Welcome copy, vehicle types, service area, opening hours, brand colours — editable by customer for content; structural changes routed to CabbyBot |
| **Team** | Invite teammates; role-based access (Owner / Admin / Viewer) at org level; optional per-Viewer restriction to specific automations |
| **Billing** | Plan, contract dates, channel count, fleet band, invoice history, payment method |
| **Support** | Ticket form to CabbyBot; open ticket status; "Request a new automation" form |

### 5.4 Internal Admin (FlowMo Staff Only)

- **Tenant provisioning console** — create org, set fleet band, select channels, enter contract terms, attach Stripe customer, set go-live date
- **Automation registry** — list all automations across all tenants, version, deployed status, last edited, assigned engineer
- **Bespoke build queue** — Kanban: Requested → Scoped → Building → UAT → Live
- **Channel credentials vault** — encrypted at rest, senior-ops access only, every access audit-logged
- **Billing reconciliation** — Stripe ↔ tenant status sync, renewal alerts (60/30/14/7 days)
- **Impersonation** — read-only "view as tenant" for support, mandatory reason field, fully audit-logged
- **Platform analytics** — MRR, ARR, contracts ending soon, churn risk, gross margin per tenant

---

## 6. Pricing & Commercial Model

### 6.1 Booking Bot Pricing (Only Published Prices)

All prices **monthly**, **excluding VAT and applicable taxes**.

#### Option A — Up to 25 Drivers / Fleet

| Configuration | Monthly Price |
|---|---|
| Single channel (e.g. WhatsApp only) | **£500 / €500 / $600** |
| Bundle — minimum 3 channels | **£1,000 / €1,000 / $1,200** |

#### Option B — 26 to 100 Drivers / Fleet

| Configuration | Monthly Price |
|---|---|
| Single channel | **£800 / €800 / $800** |
| Bundle — minimum 3 channels | **£1,800 / €1,800 / $2,000** |

#### Option C — Custom / Enterprise

- 101+ drivers/fleet, OR
- More than 3 channels in a bundle, OR
- Any requirement outside Options A/B

→ **Contact Us.** Quoted individually.

### 6.2 One-Time Setup Fee + Contract

- **One-time Setup Fee: £1,000 / €1,000 / $1,200** — payable upfront before build starts.
- **12-month minimum contract** — billed monthly after setup, non-cancellable mid-term except for cause.
- Setup fee covers: bespoke automation build, channel integration, dispatch integration (AutoCab, iCabbi, or Cordic), brand & content customisation, training session, 30-day post-launch hypercare.

### 6.3 Add-On Automations (Priced on Demand)

- **Support Bot** — post-booking queries, cancellations, lost property, complaints
- **Driver Solution** — dispatch notifications, status updates, driver comms automation
- **Lost Property Bot**
- **Complaints / CSAT automation**
- **Marketing automations** — re-engagement, loyalty, promotions
- **Custom integrations** — non-AutoCab dispatch, CRM, accounting
- **Additional channels** beyond the contracted bundle
- **Voice agent** — inbound call handling via Twilio + OpenAI Realtime (v1.3 roadmap)

### 6.4 Customer-Borne External Costs (Transparency)

| Cost Item | Who Pays | Notes |
|---|---|---|
| WhatsApp conversation fees | **Customer** | Customer's own Meta Business account |
| Telegram / Messenger / IG volume | **Customer** | Customer's own bot/channel accounts |
| LLM / AI token costs | **Customer** (or itemised pass-through) | Customer brings own OpenAI/Anthropic key, or CabbyBot passes through at cost with monthly statement |
| AutoCab / iCabbi / Cordic API subscription | **Customer** | Existing dispatch contract, untouched |
| **CabbyBot subscription** | Customer → CabbyBot | Monthly Stripe invoice |
| **CabbyBot setup fee** | Customer → CabbyBot | One-time, upfront |

### 6.5 Stripe Implementation

- **Stripe Billing** — subscription for the monthly fee; one-time invoice for the setup fee.
- **Stripe Tax** — UK VAT and global tax handled automatically.
- **Customer Portal** — customers update payment method and download invoices; plan changes go through CabbyBot Admin.
- **Webhooks:**
  - `customer.subscription.created/updated/deleted` → sync tenant status in Supabase
  - `invoice.payment_failed` → notify CabbyBot Ops + email customer; do **not** auto-suspend during contract term (manual per contract)
  - `invoice.paid` → log, no auto action
- **Currency** — GBP, EUR, USD depending on customer location; Stripe handles conversion.
- **Billing start** — setup fee billed as one-off invoice when contract is signed; monthly billing begins on go-live date.

---

## 7. Technical Architecture

### 7.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend — marketing site + tenant dashboard + admin | **Next.js 15** (App Router) + **React 19** + **TypeScript** + **Tailwind v4** | Modern, fast, edge-ready |
| Backend API | **Next.js Route Handlers** + **TypeScript** | Co-located with frontend; eliminates separate Fastify service complexity for v1 |
| Auth | **Supabase Auth** (email/password, magic link, invite-only) | Native integration with Supabase RLS; public signup disabled; all accounts admin-invited |
| Database | **Supabase (PostgreSQL 15)** with **Row Level Security** | Multi-tenant isolation at DB layer; real-time subscriptions for live dashboard feeds |
| Realtime | **Supabase Realtime** | Live booking feed, conversation updates, automation status changes pushed to dashboard |
| Storage | **Supabase Storage** | Logos, conversation transcripts archive, booking exports |
| Cache & queue | **Redis** + **BullMQ** (Upstash Redis, serverless) | Webhook fan-out, async dispatch calls, session TTL management |
| Automation engine | **CabbyBot Automation Engine** *(n8n self-hosted, queue mode, one project per tenant)* | **Never named publicly** |
| Session state (n8n) | **n8n Data Tables** (per-tenant, per-automation) | Stores the booking state machine: step, slots, address JSON, flight data, manage-booking state |
| Email | **Resend** | Transactional + admin notifications |
| Payments | **Stripe Billing** + **Stripe Tax** | Subscriptions, setup fee invoices, UK VAT |
| Flight data | **Aviation Stack API** (or AviationEdge) | Real-time flight lookup for airport pickup; terminal resolution for LHR T1/T2/T3/T4/T5 |
| Observability | **OpenTelemetry → Grafana Cloud** + **Sentry** | Cross-stack tracing, error tracking |
| Infra | **Vercel** (Next.js) + **Hetzner Cloud** (n8n + Redis) + **Supabase** (managed Postgres) + **Cloudflare** (DNS/WAF/CDN) | UK/EU data residency |
| CI/CD | **GitHub Actions** + Vercel preview deployments per PR | Standard |

### 7.2 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Customer Channels                         │
│  WhatsApp · Telegram · Messenger · Instagram · Widget   │
│  (customer's own numbers/accounts; customer-paid API fees)     │
└─────────────────────────────┬──────────────────────────────────┘
                              │ webhooks
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  CabbyBot Edge Gateway (Next.js Route Handler)                 │
│  - Resolves channel-id → tenant_id → automation_id            │
│  - Signature verification, rate limiting, idempotency          │
│  - Forwards to the correct automation webhook in the engine    │
└─────────────────────────────┬──────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  CabbyBot Automation Engine (n8n, queue mode, internal)        │
│  - One project per tenant                                      │
│  - Multiple workflows per tenant (one per automation)          │
│  - Booking state machine: step/slot/session in Data Tables     │
│  - Dispatch calls: AutoCab / iCabbi / Cordic                   │
│  - Voice: WhatsApp audio → Whisper → GPT slot extraction       │
│  - Flight lookup: Aviation API → terminal zone mapping (LHR)   │
└──────────┬──────────────────────┬──────────────────────────────┘
           │ writes               │ writes
           ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────────────┐
│  n8n Data Tables     │  │  Supabase (PostgreSQL + RLS)          │
│  (session state,     │  │  (tenants, users, automations,        │
│  booking slots,      │  │   bookings, conversations, audit log) │
│  manage-booking tmp) │  └─────────────────┬────────────────────┘
└──────────────────────┘                    │ Realtime
                                            ▼
                          ┌────────────────────────────────────────┐
                          │  CabbyBot Dashboard (Next.js)          │
                          │  - Org overview — all automations      │
                          │  - Per-automation drill-down           │
                          │  - Live booking feed (Supabase RT)     │
                          │  - Analytics charts                    │
                          │  - Per-automation start/stop control   │
                          └────────────────────────────────────────┘
```

### 7.3 Multi-Tenancy & Multi-Automation Model

- **Supabase Organisation** concept maps to 1 CabbyBot tenant (one `tenants` row).
- Each tenant has **one or more automations** in the engine, each as a separate n8n workflow within that tenant's project.
- **Supabase RLS:** every business table has `tenant_id`; automation-scoped tables also carry `automation_id`. A session-authenticated user can only read/write rows where `tenant_id = auth.jwt()->'tenant_id'`.
- **Channels:** each external channel (WhatsApp number, Telegram bot, etc.) is bound to exactly one automation at the gateway layer. An automation can have multiple channels; a channel cannot serve multiple automations.
- **Supabase Auth invite flow:** the CabbyBot admin creates the tenant and sends an invite via Supabase Auth `invite()` — user sets their password via the email link. Public signup is disabled at the Supabase project level (`DISABLE_SIGNUP=true`).

### 7.4 Supabase Auth Configuration

```
- provider: email (invite-only; no public signup)
- JWT claims: { tenant_id, role, automation_restrictions[] }
- MFA: enforced for Owner and Admin roles
- Session: 7-day sliding window; refresh tokens rotated on use
- Hooks: after-sign-in hook updates users.last_login_at
- RLS: enabled on all tenant-scoped tables
```

### 7.5 Booking State Machine (n8n Session / Data Table)

The n8n Data Table (`taxi_sessions`) stores one row per active customer phone number per automation. It persists the full booking conversation state across message turns. This table is **operational** (not analytics) — it is owned by n8n, written by the automation, and read by the dashboard for live conversation views.

| Field | Type | Purpose |
|---|---|---|
| `phone` | text (PK) | Customer's E.164 phone number |
| `step` | text | Current state-machine step (see §7.5.1) |
| `status` | text | `open` / `closed` / `expired` |
| `lastActiveAt` | ISO timestamp | Last message received; session expires after 30 min idle |
| `intent` | text | `book` / `airport` / `quote` / `manage` / `modify` / `cancel` / `change` / `answer` / `unknown` |
| `pickupText` | text | Raw pickup address as said by customer |
| `destinationText` | text | Raw destination address as said by customer |
| `pickupAddressJson` | JSON | Resolved dispatch address object (zone, coordinates, postcode) |
| `destinationAddressJson` | JSON | Resolved dispatch address object |
| `vehicleType` | text | `saloon` / `estate` / `mpv` / `8seater` / `wheelchair` |
| `passengerName` | text | Passenger name for the booking |
| `pickupDateTime` | ISO timestamp | Resolved pickup date/time (UTC) |
| `contactNumber` | text | Contact number for the booking |
| `lastQuotePrice` | text | Last quoted fare shown to customer |
| `lastBookingId` | text | Dispatch booking reference |
| `pickupTimeMode` | text | `ASAP` / `Fixed` |
| `passengerCount` | integer | Number of passengers |
| `capabilitiesJson` | JSON | Vehicle capability flags from dispatch |
| `lastQuoteEta` | text | ETA shown to customer (e.g. "38 min") |
| `airportJson` | JSON | Full airport/flight object for airport pickups |
| `pinLat` / `pinLng` | float | WhatsApp location pin coordinates |
| `driverNote` | text | Note to driver |
| `noteNextStep` | text | Next step to jump to after collecting a note |
| `selectedBookingId` | text | For manage-booking flow |
| `managedBookingsJson` | JSON | Array of the customer's existing bookings |
| `selectedBookingIsCurrent` | boolean | Whether selected booking is in-progress |
| `pendingModifyJson` | JSON | Fields being modified in a modify flow |
| `cancelReason` | text | Cancellation reason (manage flow) |
| `modifiedPickupAddressJson` | JSON | Modified pickup (modify flow) |
| `modifiedDestinationAddressJson` | JSON | Modified destination (modify flow) |
| `selectedBookingRowVersion` | integer | Optimistic concurrency for modify |
| `selectedBookingJson` | JSON | Full dispatch booking object for the selected booking |
| `lookupPhone` | text | Phone used for dispatch lookup (may differ from WA number) |
| `nextAction` | text | Internal routing signal for the next node |

#### 7.5.1 State Machine Steps

```
welcome
awaiting_intent
awaiting_time_mode
awaiting_pickup_time
awaiting_pickup
resolving_pickup_text
resolving_pickup_pin
awaiting_destination
resolving_destination_text
awaiting_vehicle
awaiting_passenger_count
awaiting_name
awaiting_contact_number
awaiting_driver_note
awaiting_quote_confirm
confirmed_booking
awaiting_airport_flight
awaiting_airport_time
awaiting_airport_vehicle
manage_booking
awaiting_manage_selection
awaiting_cancel_confirm
awaiting_modify_field
awaiting_modify_pickup
awaiting_modify_destination
awaiting_modify_time
send_cancel_result
```

### 7.6 Dispatch Integration Architecture

The engine supports three dispatch adapters via a common interface. The adapter is selected per-tenant at provisioning time.

```typescript
interface DispatchAdapter {
  lookupAddress(query: string, companyId: number): Promise<AddressResult[]>;
  getZones(companyId: number): Promise<Zone[]>;
  getCapabilities(companyId: number): Promise<Capability[]>;
  getQuote(params: QuoteParams): Promise<QuoteResult>;
  createBooking(params: BookingParams): Promise<BookingResult>;
  getBooking(bookingId: string, companyId: number): Promise<BookingResult>;
  modifyBooking(bookingId: string, params: Partial<BookingParams>): Promise<BookingResult>;
  cancelBooking(bookingId: string, companyId: number): Promise<void>;
  searchFlights(flightNumber: string, companyId: number): Promise<FlightResult[]>;
}
```

#### 7.6.1 AutoCab (v1 — Primary)

- Auth: per-tenant subscription key + `companyId` (customer's existing AutoCab contract)
- Base URL: customer-specific AutoCab instance endpoint
- Endpoints used:
  - `POST /address` — address search with disambiguation
  - `GET /zones` — zone list for terminal mapping
  - `GET /capabilities` — vehicle types available
  - `POST /quote` — real-time fare quote
  - `POST /booking` — create booking
  - `GET /booking/{id}` — retrieve booking (manage flow)
  - `PATCH /booking/{id}` — modify booking
  - `DELETE /booking/{id}` — cancel booking
  - `GET /flights/search` — flight lookup for airport pickups
- LHR terminal zone mapping: T1/T2/T3 → zone `LHR T123`; T4 → zone `LHR T4`; T5 → zone `LHR T5` (hardcoded zone ID list maintained per tenant)
- IATA code resolution: airline code extracted from flight number, matched against IATA lookup table embedded in the workflow
- Buffer logic: flight arrival time + configurable buffer (default 30 min) = pickup time sent to dispatch

#### 7.6.2 iCabbi (v1.2 — Roadmap)

- REST API adapter following the same `DispatchAdapter` interface
- Auth: iCabbi API key + company identifier
- Key difference from AutoCab: booking confirmation uses polling rather than synchronous response
- Quote model: iCabbi returns fare ranges; normalised to single `lastQuotePrice` for the state machine

#### 7.6.3 Cordic (v1.2 — Roadmap)

- SOAP/REST hybrid; wrapped in a normalisation layer
- Auth: Cordic API key + company ID
- Zone model differs from AutoCab; zone mapping table maintained per tenant

### 7.7 Workflow Control API

```
POST /api/orgs/:orgId/automations/:automationId/start
POST /api/orgs/:orgId/automations/:automationId/stop
POST /api/orgs/:orgId/automations/:automationId/restart
GET  /api/orgs/:orgId/automations/:automationId/status
GET  /api/orgs/:orgId/automations/:automationId/runs?limit=50
GET  /api/orgs/:orgId/automations/:automationId/runs/:runId
```

- Stopping one automation does **not** affect any other automation in the same organisation.
- Stop action drains in-flight executions gracefully (5-second timeout).
- All actions are audit-logged: `actor_user_id`, `org_id`, `automation_id`, `timestamp`, `action`.

### 7.8 Voice Note Pipeline (WhatsApp)

```
WhatsApp audio message
  → Extract_WhatsApp_Data (node) — captures mediaId, messageType=audio
  → [Branch: audio path]
  → Get_Media_URL — GET /graph.facebook.com/v19.0/{mediaId}
  → Download_Media — fetches binary from Meta CDN
  → Whisper_Transcribe — OpenAI Whisper, language: auto-detect
  → Extract_Slots — GPT system prompt (slot extraction: intent, pickup, destination,
                    whenText, vehicle, passengers, luggage, passengerName, note,
                    airport, terminal, flightNumber, bookingReference)
  → Normalize_Voice — maps to clean slot object, validates vehicle/intent enums
  → [Merge back into main booking state machine at intent router]
```

The voice pipeline runs as a **sub-workflow** (`WA Voice Booking Processor`) called from the main booking workflow when `messageType = audio`. All normalised slots are returned to the parent workflow and processed identically to text input.

---

## 8. Data Model (Supabase PostgreSQL + RLS)

### 8.1 Core Tables

```sql
-- Tenants (one per cab company)
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  country       text NOT NULL,
  plan_band     text NOT NULL CHECK (plan_band IN ('A-Single','A-Bundle','B-Single','B-Bundle','Custom')),
  currency      text NOT NULL CHECK (currency IN ('GBP','EUR','USD')),
  stripe_customer_id text,
  status        text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding','active','suspended','churned')),
  contract_start date,
  contract_renewal date,
  monthly_price numeric(10,2),
  setup_fee_paid boolean DEFAULT false,
  is_demo       boolean DEFAULT false,
  dispatch_adapter text NOT NULL DEFAULT 'autocab' CHECK (dispatch_adapter IN ('autocab','icabbi','cordic')),
  dispatch_company_id text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Users (linked to Supabase Auth)
CREATE TABLE users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id),
  email         text NOT NULL,
  full_name     text,
  is_demo_user  boolean DEFAULT false,
  last_login_at timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- Tenant users (many-to-many with role)
CREATE TABLE tenant_users (
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('Owner','Admin','Viewer')),
  automation_restrictions uuid[] DEFAULT '{}',  -- empty = all automations visible
  invited_by    uuid REFERENCES users(id),
  invited_at    timestamptz DEFAULT now(),
  accepted_at   timestamptz,
  PRIMARY KEY (tenant_id, user_id)
);

-- Automations (one or more per tenant)
CREATE TABLE automations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  name                text NOT NULL,
  type                text NOT NULL CHECK (type IN ('Booking','Support','Driver','Custom')),
  engine_workflow_id  text,   -- n8n workflow ID (internal only)
  engine_project_id   text,   -- n8n project ID for this tenant (internal only)
  status              text NOT NULL DEFAULT 'building' CHECK (status IN ('building','uat','live','stopped','error')),
  dispatch_adapter    text CHECK (dispatch_adapter IN ('autocab','icabbi','cordic')),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Channels (each bound to exactly one automation)
CREATE TABLE channels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  automation_id   uuid NOT NULL REFERENCES automations(id),
  type            text NOT NULL CHECK (type IN ('whatsapp','telegram','messenger','instagram','widget')),
  external_id     text,          -- phone number ID, bot username, page ID, etc.
  webhook_path    text NOT NULL, -- e.g. /webhooks/whatsapp/{automation_id}
  credentials_ref text,          -- vault reference (never the credential itself)
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error','disconnected')),
  token_expires_at timestamptz,
  last_message_at  timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Conversations (one per customer chat session per automation)
CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  automation_id   uuid NOT NULL REFERENCES automations(id),
  channel_id      uuid REFERENCES channels(id),
  customer_handle text NOT NULL,   -- phone / telegram user id / etc.
  customer_name   text,
  language        text DEFAULT 'en',
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  outcome         text CHECK (outcome IN ('booked','quoted','abandoned','managed','cancelled','unknown')),
  abandonment_reason text
);

-- Messages (every turn in a conversation)
CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type    text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','voice','location','image','interactive','card')),
  payload         jsonb NOT NULL,   -- raw message body
  transcript      text,            -- for voice: Whisper output
  intent_extracted jsonb,          -- for voice: GPT slot extraction result
  ts              timestamptz NOT NULL DEFAULT now()
);

-- Bookings (one per confirmed booking, linked to conversation)
CREATE TABLE bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  automation_id     uuid NOT NULL REFERENCES automations(id),
  conversation_id   uuid REFERENCES conversations(id),
  channel_type      text,
  dispatch_ref      text,        -- AutoCab / iCabbi / Cordic booking reference
  dispatch_adapter  text,
  passenger_name    text,
  customer_handle   text,
  pickup_address    jsonb,       -- full resolved address object from dispatch
  destination_address jsonb,
  vehicle_type      text,
  passenger_count   integer,
  fare              numeric(10,2),
  currency          text DEFAULT 'GBP',
  pickup_at_utc     timestamptz,
  pickup_time_mode  text,
  airport_json      jsonb,       -- populated for airport pickups (flight, terminal, buffer)
  driver_note       text,
  payment_method    text,
  status            text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','dispatched','completed','cancelled','no_show')),
  your_reference_1  text,        -- WA-{phone}
  your_reference_2  text,        -- vehicle type
  your_reference_3  text,        -- fare string
  raw_dispatch_json jsonb,       -- full dispatch response for audit
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Automation runs (executions — n8n syncs these)
CREATE TABLE automation_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid NOT NULL REFERENCES automations(id),
  engine_run_id   text,          -- n8n execution ID
  status          text NOT NULL CHECK (status IN ('running','success','error','cancelled')),
  started_at      timestamptz NOT NULL,
  finished_at     timestamptz,
  duration_ms     integer,
  error_message   text,
  trigger_channel text,
  trigger_phone   text           -- sanitised; no raw PII in run metadata
);

-- Subscriptions (Stripe ↔ tenant)
CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  stripe_sub_id         text UNIQUE NOT NULL,
  plan_band             text NOT NULL,
  monthly_price         numeric(10,2),
  currency              text,
  status                text,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  contract_end          date,
  cancel_at             timestamptz
);

-- Setup fees
CREATE TABLE setup_fees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  stripe_invoice_id text UNIQUE,
  amount            numeric(10,2),
  currency          text,
  paid_at           timestamptz
);

-- Audit log (immutable, append-only)
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid REFERENCES tenants(id),
  actor_user_id uuid REFERENCES users(id),
  action        text NOT NULL,
  target_type   text,
  target_id     text,
  metadata      jsonb,
  ip_address    inet,
  ts            timestamptz NOT NULL DEFAULT now()
);
```

### 8.2 Row Level Security Policies

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE automations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

-- Tenant user access: user may only see their tenant's data
CREATE POLICY tenant_isolation ON automations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Viewer with automation restrictions: may only see allowed automations
CREATE POLICY automation_restriction ON automations
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    AND (
      id = ANY(
        (SELECT automation_restrictions FROM tenant_users
         WHERE user_id = auth.uid() AND tenant_id = automations.tenant_id)::uuid[]
      )
      OR
      (SELECT automation_restrictions FROM tenant_users
       WHERE user_id = auth.uid() AND tenant_id = automations.tenant_id) = '{}'
    )
  );

-- Similar policies cascade to bookings, conversations, messages, channels, runs
-- (tenant_id + automation_id checked against JWT)

-- Audit log: insert-only for authenticated users; no SELECT for tenant users
-- (readable only by service_role / FlowMo admin)
```

### 8.3 Supabase Realtime Subscriptions (Dashboard)

The dashboard subscribes to Realtime channels for live updates:

```typescript
// Live booking feed for a specific automation
supabase
  .channel(`bookings:automation_id=${automationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'bookings',
    filter: `automation_id=eq.${automationId}`
  }, (payload) => updateBookingFeed(payload.new))
  .subscribe();

// Automation status change (e.g. n8n sync sets status to 'error')
supabase
  .channel(`automations:tenant_id=${tenantId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'automations',
    filter: `tenant_id=eq.${tenantId}`
  }, (payload) => updateAutomationStatus(payload.new))
  .subscribe();
```

---

## 9. Detailed Feature Requirements

### 9.1 Marketing Website (Public)

- **Pages:** Home, How It Works, Channels, Pricing, Custom Solutions, Case Studies, About, Contact, Legal (Privacy, Terms, DPA, Cookie Policy)
- **No public signup form.** Every CTA leads to **"Book a Discovery Call"** (Calendly or Cal.com embed).
- **Pricing page:** Options A / B / C layout exactly as in §6.1 — setup fee and 12-month contract prominently stated.
- **Transparency section:** "What you pay externally" — lists Meta/Telegram/ fees, LLM tokens, dispatch API subscription as customer-borne costs.
- **Demo WhatsApp number:** a CabbyBot-owned number prospects can message to experience the bot live.
- **ROI calculator:** "How many bookings per day does your bot capture?" interactive widget.
- **"Try the Dashboard" link:** routes to the demo tenant one-click login (§9.6).
- **Dispatch badges:** AutoCab, iCabbi, and Cordic logos with "Supported" badges.

### 9.2 Onboarding (Admin-Driven)

1. Discovery call booked via marketing site.
2. CabbyBot scopes the requirement and quotes (Option A/B/C/Custom).
3. Contract signed; setup fee invoiced via Stripe.
4. **CabbyBot Admin** creates the tenant in the admin console:
   - Organisation name, country, primary contact email
   - Plan band, channels, languages
   - Dispatch system (AutoCab / iCabbi / Cordic) + company ID
   - Contract start date, monthly price, currency
   - Stripe customer ID
5. Admin clicks **"Send Invite"** → Supabase Auth `invite()` sends email; user sets password via the link.
6. Customer logs in → sees their organisation with 0 automations. A holding state reads: *"Your automation is being built. We'll notify you when it goes live."*
7. Solution Engineer builds the bespoke automation in n8n, wires channel credentials, validates in UAT.
8. Admin marks automation `live` in the admin console → customer sees it on their dashboard; monthly billing begins.

### 9.3 Dashboard — Page-by-Page Detail

#### 9.3.1 Organisation Overview (Post-Login Home)

**URL:** `/dashboard`

- **Header row:** org name, plan band, contract renewal date, assigned CabbyBot support contact.
- **KPI strip:** total bookings today (across all automations), total conversations today, live automation count.
- **Automations grid:** one card per automation showing:
  - Name and type tag (Booking / Support / Driver / Custom)
  - Status badge (Live / Stopped / Error / Building)
  - Dispatch adapter badge (AutoCab / iCabbi / Cordic)
  - Channel icons (WhatsApp, Telegram, etc.) with colour indicating health (green = healthy, amber = token warning, red = disconnected)
  - Today's booking count (booking-type only)
  - Today's conversation count
  - Today's conversion percentage
  - Start / Stop button (disabled if Building/UAT; shows confirm modal)
  - "Open Dashboard" button
- **"Request a new automation" CTA** → opens pre-filled ticket form to CabbyBot.
- **Realtime:** automation status cards update live via Supabase Realtime.

#### 9.3.2 Per-Automation Overview

**URL:** `/dashboard/automations/[automationId]`

- **Header:** automation name, status badge, dispatch adapter, Start / Stop / Restart buttons (with confirm modal), last run timestamp.
- **KPI strip:** today's bookings (if booking-type), conversations, conversion %, active channel count, average response time.
- **Trend chart:** bookings/conversations today vs same weekday last week (line chart, recharts).
- **Booking mode split** (booking-type only): ASAP / Scheduled / Airport pickup — donut chart.
- **Vehicle type split** (booking-type only): bar chart.
- **Recent bookings feed:** live table — last 20 bookings, updating in real-time via Supabase Realtime subscription.
- **Recent conversations:** last 10 sessions with outcome badge.
- **Last 10 runs:** status, duration, channel trigger.

#### 9.3.3 Bookings

**URL:** `/dashboard/automations/[automationId]/bookings`

Fully featured booking management table with **live updates**.

**Filters:**
- Date range picker (default: last 7 days)
- Channel selector (WhatsApp / Telegram / etc.)
- Status selector (confirmed / dispatched / completed / cancelled / no_show)
- Booking mode (ASAP / Scheduled / Airport)
- Customer search (name, phone, postcode)
- Dispatch reference search

**Table columns:**
| Column | Detail |
|---|---|
| Booking ID | Internal UUID (truncated) |
| Dispatch Ref | AutoCab / iCabbi / Cordic reference number |
| Date & Time | Pickup date/time (local TZ) |
| Customer | Name + contact handle (phone/username) |
| Channel | Icon + channel type |
| Pickup | Address (town + postcode) |
| Destination | Address (town + postcode) |
| Vehicle | Vehicle type icon |
| Pax | Passenger count |
| Fare | Quoted fare |
| Status | Badge (confirmed / dispatched / completed / cancelled) |
| Actions | "View Details" |

**Booking Detail Panel** (slide-over):
- Full pickup and destination address objects
- Passenger name, contact number, driver note
- Airport section (if airport pickup): flight number, airline, terminal, arrival time (live status if within 4h), buffer minutes, pickup time
- Full conversation transcript (expandable)
- Dispatch reference with deeplink to dispatch system (if supported)
- Booking JSON (collapsed, for engineering debug)
- Cancel / mark status actions (Owner / Admin only)

**CSV Export:** downloads all rows matching current filters.

#### 9.3.4 Conversations

**URL:** `/dashboard/automations/[automationId]/conversations`

**Filters:** date range, channel, outcome (booked / quoted / abandoned / managed / cancelled), language, customer search.

**Table:** conversation ID, customer, channel, started, duration, message count, outcome, language.

**Conversation Detail Panel:**
- Full message-by-message transcript
- Voice messages show: audio icon + Whisper transcript + extracted slots
- Location pins show: embedded map preview (Mapbox static API) or lat/lng fallback
- Intent labels per turn (from the automation's slot extraction)
- State machine path: which steps were visited in order
- Booking card (if booked) linking to the full booking record

#### 9.3.5 Analytics

**URL:** `/dashboard/automations/[automationId]/analytics`

All charts use **recharts** with dark-mode-aware theming.

**Date controls:** date range picker + period-over-period toggle (vs previous period / vs same period last year).

**Sections:**

1. **Conversion Funnel**
   ```
   Inbound → Greeted → Intent Identified → Quoted → Confirmed → Booked
   ```
   Shows count and percentage drop-off at each stage.

2. **Channel Mix**
   Donut chart — proportion of conversations by channel (WhatsApp, Telegram, etc.) for this automation only.

3. **Booking Mode Split** *(booking-type only)*
   ASAP / Scheduled / Airport pickup — bar chart with trend.

4. **Vehicle Type Breakdown** *(booking-type only)*
   Saloon / Estate / MPV / 8-Seater / Wheelchair — horizontal bar.

5. **Top Pickup Zones**
   Table — zone name, booking count, % of total.

6. **Top Destinations**
   Table — destination address/zone, count, %.

7. **Peak Hours Heatmap**
   7-day × 24-hour grid; colour intensity = booking volume. Reveals when to staff dispatch vs when the bot covers everything.

8. **Response Time Distribution**
   Histogram of message-to-reply durations across all turns. p50 / p90 / p99 lines.

9. **Abandonment Reasons**
   Breakdown of why sessions ended without a booking (timeout, no pickup, no destination, no vehicle chosen, etc.).

10. **Voice Note Stats** *(if automation supports voice)*
    Total voice notes, transcription success rate, average Whisper confidence, most common voice intents.

#### 9.3.6 Bot Configuration

**URL:** `/dashboard/automations/[automationId]/config`

Editable by Owner / Admin:

- **Welcome message** — per-channel copy editor (rich text with variable insertion: `{{company_name}}`, `{{opening_hours}}`, `{{contact_number}}`)
- **Vehicle types** — toggle which vehicle types are offered in this automation
- **Service area** — free-text description shown to customers who request outside the area
- **Opening hours** — weekly schedule editor; times in local timezone; automation handles "outside hours" message
- **Brand colours** — primary and secondary hex values used in WhatsApp interactive cards
- **Language settings** — which languages are active for this automation
- **Driver note prompt** — optional; whether the bot asks for a driver note
- **"Request a structural change"** — opens a support ticket (because automation logic is bespoke and editing the flow requires engineering)

All changes save to Supabase and are synced to the automation by n8n on its next invocation (or via a config webhook if the automation is running).

#### 9.3.7 Channels

**URL:** `/dashboard/automations/[automationId]/channels`

One card per channel attached to this automation:

- Channel icon + type label + external ID (phone number / username / page name)
- Status badge (Active / Error / Disconnected)
- "Token expires in N days" warning (amber at 7d, red at 1d)
- "Send test message" button → sends a standard test message to a configurable test number
- "Reconnect" button → opens a guide for re-issuing credentials (Owner / Admin only)
- Last message received timestamp + count in last 24h

**Adding a new channel:** opens a support ticket to CabbyBot Admin (structural change).

#### 9.3.8 Team (Org-Level)

**URL:** `/dashboard/team`

- **Members table:** name, email, role, last login, automations visible (if restricted Viewer)
- **Invite by email:** enter email + select role → Supabase invite email sent
- **Role change / revoke** (Owner only)
- **Automation access restriction** for Viewers: multi-select from the org's automations
- **Audit trail:** last 50 team actions (invites, role changes, start/stop, config changes)

#### 9.3.9 Billing (Org-Level)

**URL:** `/dashboard/billing`

- **Plan card:** plan band, fleet size, channels included, monthly price (incl. currency), contract start, contract renewal date
- **Setup fee status:** "Paid — £1,000 on DD/MM/YYYY" with invoice download
- **Monthly invoices table:** invoice number, period, amount, status, PDF download
- **"Update Payment Method"** — opens Stripe Customer Portal in new tab
- **"Request plan change or add automation"** → opens support ticket

#### 9.3.10 Support

**URL:** `/dashboard/support`

- Open tickets table: ID, subject, created, status (Open / In Progress / Resolved)
- **New ticket form:** subject, category (Technical / Billing / Build request / Other), description, attachments
- **"Request a new automation"** button — pre-fills category and routes to the CabbyBot build queue
- Knowledge base link (external, e.g. Intercom or Notion)

### 9.4 Internal Admin (FlowMo Staff Only)

**URL:** `/admin` — protected by a separate Supabase Auth `admin` role claim; only accessible to users with `is_flowmo_staff = true`.

#### 9.4.1 Tenant Management

- **List view:** all tenants, status, plan band, dispatch adapter, MRR, contract renewal, last login
- **Create tenant:** form — org name, slug, country, plan band, currency, dispatch adapter + company ID, primary contact email, contract dates, monthly price, Stripe customer ID, setup fee amount
- **Tenant detail:** all automations, all users, all channels, all invoices, full audit log for that tenant
- **Actions:** suspend, reinstate, mark churned, edit contract terms
- **"Send Invite"** button on tenant detail → triggers Supabase Auth `invite()` for the primary contact

#### 9.4.2 Automation Registry

Global list of all automations across all tenants:
- Tenant name, automation name, type, status, dispatch adapter, n8n workflow ID (internal), last run, assigned engineer
- **"Open in Automation Engine"** — internal deeplink to n8n editor, visible only to FlowMo staff, **never exposed in the tenant dashboard**
- Status filters: building / UAT / live / stopped / error

#### 9.4.3 Build Queue (Kanban)

Kanban board: **Requested → Scoped → Building → UAT → Live**

Each card: tenant name, automation name, type, assigned engineer, target go-live date, notes.
- Drag-and-drop to move between stages
- Stage transition triggers a Resend email to the tenant (configurable per stage)
- "Go Live" action on UAT → marks automation `live` in Supabase + notifies tenant

#### 9.4.4 Channel Credentials Vault

- List of all credentials by tenant + channel type (no raw values shown in list)
- **Add credential:** form → stored encrypted using Supabase Vault (`pgcrypto`)
- **View / rotate** — senior ops only; every access logged in `audit_log`
- Token expiry warnings surfaced here before they surface in the tenant dashboard

#### 9.4.5 Stripe Panel

- Summary cards: MRR, ARR, active contracts, contracts renewing in 30 days
- Contract renewal alert table: tenant, renewal date, plan, MRR — sorted by soonest
- "Open in Stripe" deeplinks per tenant subscription
- Manual sync button: re-fetches Stripe subscription status for a specific tenant

#### 9.4.6 Impersonation

- Search by tenant or user email
- Select a tenant user to impersonate (read-only session)
- **Mandatory reason field** before session starts (logged to `audit_log`)
- Impersonation banner visible at all times during the session
- Session auto-expires after 15 minutes; no write actions possible during impersonation

#### 9.4.7 Platform Analytics

- **MRR / ARR** — total and by plan band (A-Single, A-Bundle, B-Single, B-Bundle, Custom)
- **New contracts MTD / YTD**
- **Contracts ending in 30 / 60 / 90 days** — churn risk table
- **Active automations count** by type (Booking / Support / Driver / Custom)
- **Gross bookings volume** — total bookings processed across all tenants (aggregate, anonymised)
- **Top tenants by MRR**
- **Setup fee pipeline** — unpaid setup fees outstanding

### 9.5 Channel Integrations

| Channel | Auth Method | Sending API | Inbound Webhook |
|---|---|---|---|
| WhatsApp Business Cloud | Customer's permanent access token (Meta Business Manager) | `graph.facebook.com/v21.0/{phone_id}/messages` | `/webhooks/whatsapp/{automationId}` |
| Telegram | Customer's bot token (BotFather) | `api.telegram.org/bot{token}/sendMessage` | `/webhooks/telegram/{automationId}` |
| Messenger | Customer's page access token | `graph.facebook.com/v21.0/me/messages` | `/webhooks/messenger/{automationId}` |
| Instagram DM | Same as Messenger (Meta) | Same as Messenger | `/webhooks/instagram/{automationId}` |
| Website widget | JWT-signed embed snippet (CabbyBot-generated) | Internal API | `/webhooks/widget/{automationId}` |

All webhook paths resolve directly to one automation (one tenant). The gateway performs signature verification before forwarding.

**WhatsApp message types handled:**
- `text` — standard message
- `interactive` — button reply (`button_reply`) and list reply (`list_reply`)
- `location` — lat/lng pin (used for pickup address)
- `audio` — voice note (routed to voice pipeline, §7.8)
- `image` — unsupported (responded to with "I can only handle text and voice messages")

### 9.6 Demo Tenant (Built-In, Mock Data)

A **dedicated demo tenant** ships with the platform. It lets prospects experience a realistic, fully populated dashboard without contacting sales.

| Item | Value |
|---|---|
| Org name | **CabbyBot Demo — Premier Cabs** |
| Demo login URL | `app.cabbybot.com/demo` (one-click, no password, read-only session) |
| Direct sign-in | `demo@cabbybot.com` / `DemoCabbyBot2026` (read-only role) |
| Plan band shown | Option B — Bundle (3 channels, 26–100 fleet, £1,800/month) |
| Dispatch shown | AutoCab |
| Channels | WhatsApp, Telegram, Website Widget |
| Automations | **3:** WhatsApp Booking Bot (live), Telegram Support Bot (live), Website Widget Booking Bot (paused) |
| Data | 6 months of deterministic mock data — bookings, conversations, analytics, peak-hour patterns, channel mix, abandonment reasons, airport pickups with real flight structures |
| Restrictions | Read-only; Start/Stop buttons show "Demo mode — action simulated" banner; no real messages sent; no billing or invite access |
| Reset | Demo state regenerated every 24h via a Supabase Edge Function cron |
| Watermark | Subtle "DEMO" ribbon in the top nav bar |

**Demo dataset must include:**
- At least 142 bookings today (WhatsApp Booking Bot), spread across ASAP / Scheduled / Airport modes
- At least 3 airport pickup bookings with full flight objects (different airlines, terminals, real-structured IATA codes like `AA136 LAX-LHR T3`)
- At least 1 voice note conversation with transcript and extracted slot display
- At least 1 location-pin conversation with map preview
- At least 1 bilingual conversation (English + one other language)
- At least 1 manage-booking conversation (customer modified a booking)
- At least 1 cancellation with reason
- Peak-hour heatmap showing realistic evening/weekend booking spikes
- All analytics charts populated with believable trends

---

## 10. Security, Compliance & Privacy

- **Hosting & data residency:** UK / EU regions only — Supabase (AWS eu-west-2), Vercel London, Hetzner Falkenstein.
- **Encryption:** TLS 1.3 everywhere; AES-256 at rest (Supabase default + Supabase Vault for credentials); secrets in environment variables, never in code.
- **Supabase Vault:** used for all channel credentials (WhatsApp tokens, Telegram bot tokens, dispatch API keys) — encrypted at column level using `pgcrypto`; raw values never appear in logs or dashboard responses.
- **PII:** customer phone numbers visible only to authenticated tenant users; used as the session key in n8n Data Tables; never written to logs.
- **Conversation retention:** 90-day default; configurable up to 24 months per negotiated contract terms.
- **GDPR / UK DPA 2018:** tenant-initiated customer data export (Supabase Edge Function) and delete (cascaded via RLS); DPA template included with every contract; DPO contact published.
- **PCI:** payment card data never touches CabbyBot servers — Stripe Checkout and Stripe Customer Portal only.
- **SOC 2 Type II:** roadmap, year 2.
- **Auth:**
  - Supabase Auth: public signup **disabled** (`DISABLE_SIGNUP=true`)
  - All accounts created via admin `invite()` flow
  - MFA enforced for Owner and Admin roles (TOTP via Supabase Auth)
  - Brute-force protection (Supabase built-in rate limiting)
  - JWT claims include `tenant_id`, `role`, `is_flowmo_staff`
- **RBAC:** Owner / Admin / Viewer at org level; optional per-automation restriction for Viewers; FlowMo Staff role with mandatory audit on impersonation.
- **Rate limiting:** at gateway, per automation + per channel. Hard caps prevent runaway costs from leaked credentials or loop attacks.
- **n8n engine:** air-gapped from public internet; accessible only from the CabbyBot gateway and the FlowMo ops VPN. The n8n editor URL is never surfaced in any customer-facing interface.
- **Demo tenant isolation:** physically separate mock data rows (`is_demo = true`); no real customer phone numbers; read-only Supabase Auth role with `tenant_id` pinned to the demo tenant only.

---

## 11. Non-Functional Requirements

| Category | Target |
|---|---|
| Marketing site Lighthouse | ≥95 performance, ≥100 accessibility |
| Dashboard p95 page load (warm) | ≤1.5s |
| API route handler p95 latency | ≤200ms |
| Channel webhook p95 ACK | ≤300ms |
| Engine response (message → reply) | p95 ≤3s, p99 ≤6s |
| Voice pipeline (audio → reply) | p95 ≤8s (Whisper + GPT + dispatch) |
| Uptime SLA (Option B+ / Custom) | 99.9% monthly |
| Disaster recovery | RPO 15min (Supabase PITR), RTO 4h |
| Browser support | Latest 2 versions of Chrome, Safari, Firefox, Edge |
| Mobile | Dashboard fully responsive ≥360px |
| Accessibility | WCAG 2.2 AA |
| Demo tenant reset cadence | Every 24h via Supabase Edge Function cron |
| Supabase connection pool | PgBouncer in transaction mode; max 100 concurrent connections per environment |
| Realtime channel limit | One Realtime channel per automation dashboard view; auto-unsubscribed on unmount |

---

## 12. API Reference (Next.js Route Handlers)

### 12.1 Authentication

All routes require a valid Supabase JWT (`Authorization: Bearer {token}`).

Supabase middleware (`middleware.ts`) validates the JWT and enforces:
- `tenant_id` claim matches the `:orgId` in the URL
- `role` is sufficient for the action (Owner/Admin for writes, any for reads)
- `is_flowmo_staff` required for `/admin/*` routes

### 12.2 Automation Control

```
GET    /api/orgs/:orgId/automations
GET    /api/orgs/:orgId/automations/:automationId
POST   /api/orgs/:orgId/automations/:automationId/start
POST   /api/orgs/:orgId/automations/:automationId/stop
POST   /api/orgs/:orgId/automations/:automationId/restart
GET    /api/orgs/:orgId/automations/:automationId/status
GET    /api/orgs/:orgId/automations/:automationId/runs?limit=50&offset=0
GET    /api/orgs/:orgId/automations/:automationId/runs/:runId
```

### 12.3 Bookings

```
GET    /api/orgs/:orgId/automations/:automationId/bookings
       ?page=1&limit=50&from=&to=&channel=&status=&mode=&search=
GET    /api/orgs/:orgId/automations/:automationId/bookings/:bookingId
GET    /api/orgs/:orgId/automations/:automationId/bookings/export
       (streams CSV)
PATCH  /api/orgs/:orgId/automations/:automationId/bookings/:bookingId
       (status update; Owner/Admin only)
```

### 12.4 Conversations

```
GET    /api/orgs/:orgId/automations/:automationId/conversations
       ?page=1&limit=50&from=&to=&channel=&outcome=&language=&search=
GET    /api/orgs/:orgId/automations/:automationId/conversations/:conversationId
GET    /api/orgs/:orgId/automations/:automationId/conversations/:conversationId/messages
```

### 12.5 Analytics

```
GET    /api/orgs/:orgId/automations/:automationId/analytics/summary
       ?from=&to=&compareTo=
GET    /api/orgs/:orgId/automations/:automationId/analytics/funnel
GET    /api/orgs/:orgId/automations/:automationId/analytics/channels
GET    /api/orgs/:orgId/automations/:automationId/analytics/zones
GET    /api/orgs/:orgId/automations/:automationId/analytics/heatmap
GET    /api/orgs/:orgId/automations/:automationId/analytics/abandonment
GET    /api/orgs/:orgId/automations/:automationId/analytics/voice
```

### 12.6 Bot Configuration

```
GET    /api/orgs/:orgId/automations/:automationId/config
PATCH  /api/orgs/:orgId/automations/:automationId/config
       (Owner/Admin only; validates and saves to Supabase)
```

### 12.7 Channels

```
GET    /api/orgs/:orgId/automations/:automationId/channels
POST   /api/orgs/:orgId/automations/:automationId/channels/:channelId/test
```

### 12.8 Team

```
GET    /api/orgs/:orgId/team
POST   /api/orgs/:orgId/team/invite         { email, role, automationRestrictions[] }
PATCH  /api/orgs/:orgId/team/:userId        { role, automationRestrictions[] }
DELETE /api/orgs/:orgId/team/:userId
GET    /api/orgs/:orgId/audit?limit=50
```

### 12.9 Billing

```
GET    /api/orgs/:orgId/billing/subscription
GET    /api/orgs/:orgId/billing/invoices
GET    /api/orgs/:orgId/billing/invoices/:invoiceId/pdf
POST   /api/orgs/:orgId/billing/portal     (creates Stripe portal session, returns URL)
```

### 12.10 Webhooks (Channel Inbound)

```
GET/POST  /webhooks/whatsapp/:automationId
GET/POST  /webhooks/telegram/:automationId
GET/POST  /webhooks/messenger/:automationId
GET/POST  /webhooks/instagram/:automationId
POST      /webhooks/widget/:automationId
```

Each webhook handler:
1. Verifies the channel signature (HMAC or token check)
2. Looks up `automation_id` → `tenant_id` → `engine_webhook_url` from Supabase
3. Forwards the payload to the engine (n8n)
4. Returns 200 immediately (engine processes async)

### 12.11 Stripe Webhooks

```
POST /webhooks/stripe
```

Handles: `customer.subscription.*`, `invoice.payment_failed`, `invoice.paid`.

### 12.12 Admin API (FlowMo Staff Only)

```
GET    /admin/api/tenants
POST   /admin/api/tenants
GET    /admin/api/tenants/:tenantId
PATCH  /admin/api/tenants/:tenantId
POST   /admin/api/tenants/:tenantId/invite
POST   /admin/api/tenants/:tenantId/suspend
GET    /admin/api/automations
GET    /admin/api/automations/:automationId
PATCH  /admin/api/automations/:automationId
GET    /admin/api/build-queue
PATCH  /admin/api/build-queue/:automationId/stage   { stage, notes, engineerId }
POST   /admin/api/build-queue/:automationId/go-live
GET    /admin/api/platform/analytics
POST   /admin/api/impersonate   { tenantId, userId, reason }
```

---

## 13. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only; admin operations

# n8n (engine — internal only; never exposed to customers)
N8N_BASE_URL=                    # internal URL e.g. http://n8n.internal:5678
N8N_API_KEY=                     # n8n API key for workflow control calls

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Resend (email)
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@cabbybot.com

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Rate limiting / gateway
WEBHOOK_RATE_LIMIT_PER_MIN=60   # per automation + channel combination

# Demo tenant
DEMO_TENANT_ID=                  # UUID of the demo tenant row in Supabase

# Internal
FLOWMO_STAFF_EMAIL_DOMAIN=flowmoai.com   # for is_flowmo_staff JWT claim assignment
```

---

## 14. Build Sequence (Epics)

### Epic 1 — Foundations

- Next.js 15 + TypeScript + Tailwind v4 monorepo
- Supabase project setup: schema migrations, RLS policies, Auth configuration (invite-only, MFA, JWT claims)
- Supabase client wrappers: `createClient()` for server and browser, middleware for auth + RLS enforcement
- Environment variable management
- CI/CD: GitHub Actions lint + typecheck + migration dry-run on every PR; Vercel deploy on merge

### Epic 2 — Marketing Site

- All public pages with CabbyBot branding and `#FFD400` accent
- Pricing page (Options A/B/C), transparency section, dispatch adapter badges (AutoCab, iCabbi, Cordic)
- Discovery call CTA (Calendly/Cal.com embed)
- ROI calculator widget
- "Try the Dashboard" link → demo tenant

### Epic 3 — Internal Admin Console

Built **before** the tenant dashboard — nothing can exist without admin first.

- Tenant provisioning form (including dispatch adapter selector)
- Automation registry + build queue (Kanban)
- Supabase invite integration
- Channel credentials vault (Supabase Vault)
- Stripe panel + renewal alerts
- Impersonation (read-only + audit)
- Platform analytics dashboard

### Epic 4 — Auth & Invite-Only Login

- Supabase Auth integration in Next.js (SSR + browser client)
- Invite flow: admin sends invite → user sets password → JWT includes `tenant_id`, `role`
- MFA enforcement for Owner/Admin (TOTP)
- Middleware: RLS-aware route protection; redirect unauthenticated users to login

### Epic 5 — Automation Engine Integration

- n8n API client: start/stop/restart/status/runs
- Webhook gateway: channel-id → automation-id resolver (Supabase lookup, cached in Redis 5 min TTL)
- Signature verification per channel
- Async forwarding to n8n with idempotency key
- Automation status sync (n8n polls or pushes status changes to Supabase)
- Audit logging for all control plane actions

### Epic 6 — Dispatch Adapter Layer

- `DispatchAdapter` interface (TypeScript)
- **AutoCab adapter** — all endpoints (address, zones, capabilities, quote, booking CRUD, flights)
- LHR terminal zone mapping (T1/T2/T3 → LHR T123, T4, T5)
- IATA code → airline name lookup table
- Airport buffer logic (arrival + N minutes = pickup time)
- Per-tenant adapter selection from `tenants.dispatch_adapter`
- iCabbi and Cordic adapters — stubs in v1, full implementation in v1.2

### Epic 7 — Tenant Dashboard

Built in order of complexity:

1. **Org overview** — automations grid + KPIs + Realtime status updates
2. **Per-automation overview** — KPI strip + trend chart + live booking feed
3. **Bookings** — full table, filters, CSV export, booking detail slide-over (incl. airport detail, transcript, dispatch JSON)
4. **Conversations** — table + transcript view (voice transcript, location pin preview, intent labels)
5. **Analytics** — all 10 sections with recharts; date range + period comparison
6. **Bot configuration** — editable fields with save to Supabase
7. **Channels** — status cards, test message, token expiry warnings
8. **Team** — invite, role management, automation restrictions, audit trail
9. **Billing** — Stripe portal integration, invoice table with PDF download
10. **Support** — ticket form

### Epic 8 — Stripe Billing

- Setup fee: one-time invoice creation via Stripe API when tenant status moves to `contract_signed`
- Monthly subscription: created when admin marks automation `live`; billing start = go-live date
- Stripe Tax: enabled on Stripe account; VAT applied automatically
- Stripe Customer Portal: session creation API + redirect
- Webhook handlers: subscription sync, payment failure notification (Resend email to ops + customer), paid logging

### Epic 9 — Demo Tenant

- Supabase seed script: 6 months of deterministic mock data for all tables
- Mock data covers: bookings (ASAP/Scheduled/Airport), conversations (text/voice/location), analytics, 3 automations, all channel types, airport pickups with real flight structures
- Demo login: one-click `app.cabbybot.com/demo` route that creates a read-only Supabase session for the demo tenant
- Read-only enforcement middleware: all write API calls from demo sessions return a 403 with a banner message
- 24h reset: Supabase Edge Function cron that truncates demo data and re-seeds

### Epic 10 — Voice Pipeline Integration

- n8n `WA Voice Booking Processor` sub-workflow deployed and wired to all WhatsApp-enabled automations
- Dashboard conversation view: voice messages rendered with transcript + extracted slots
- Analytics: voice note stats section (§9.3.5 item 10)
- Whisper language auto-detect → conversation `language` field set accordingly

### Epic 11 — Observability & QA

- OpenTelemetry instrumentation in Next.js route handlers and n8n workflows
- Grafana Cloud: request latency, error rate, webhook throughput, dispatch API latency per adapter
- Sentry: error tracking (frontend + server)
- Playwright E2E test suite: booking flows (text + voice), manage booking, admin provisioning, demo tenant
- Load testing: webhook endpoint under 100 concurrent messages

### Epic 12 — Launch Readiness

- Legal pages (Privacy, Terms, DPA, Cookie Policy)
- Status page (Instatus or Atlassian)
- Marketing-site demo WhatsApp number (live bot, CabbyBot-owned number)
- Sales collateral: one-pager, demo script, pricing deck
- Ops runbook: tenant provisioning SOP, channel credential rotation procedure, incident response

---

## 15. Roadmap

### v1.0 — GA (This Build)

Marketing site, admin-only provisioning, multi-automation per org, full tenant dashboard (all 10 sections, production-ready), per-automation workflow control, Stripe billing (subscription + setup fee), WhatsApp (text + voice + location) + Telegram + Messenger + Instagram + Widget, **AutoCab dispatch integration** (address, quote, booking CRUD, flights, LHR terminal routing), demo tenant with deterministic mock data, English.

### v1.1 — Languages

Hindi, Arabic, Spanish, French language packs for bespoke builds; multilingual slot extraction prompt variants.

### v1.2 — Dispatch Adapters

**iCabbi** full adapter; **Cordic** full adapter. Admin console dispatch selector active for all three.

### v1.3 — Voice Agent

AI inbound voice (phone calls) via Twilio Programmable Voice + OpenAI Realtime API — sold as a bespoke add-on alongside the existing WhatsApp voice note support.

### v2.0 — Partner Programme

Reseller programme for regional integrators; revenue share model; white-label dashboard option.

---

## 16. Success Metrics (First 12 Months Post-Launch)

| Metric | Target |
|---|---|
| Paying customers | 40 |
| MRR | £45,000 |
| Setup-fee revenue | £40,000+ |
| Average automations per customer | 1.5 |
| Discovery call → signed contract | ≥30% |
| 12-month renewal rate | ≥80% |
| Median setup-fee-paid → go-live | ≤21 days |
| Customer CSAT | ≥4.5/5 |
| Gross margin | ≥70% |
| Dashboard p95 load (warm) | ≤1.5s (measured in production) |
| WhatsApp message → bot reply | p95 ≤3s |
| Voice note → bot reply | p95 ≤8s |

---

## 17. Open Questions for Confirmation Before Build

1. **AI token costs:** customer brings their own OpenAI/Anthropic key, or CabbyBot passes through at cost with monthly itemised statement?
2. **iCabbi + Cordic in v1.0:** ship as stubs (admin can select but automation will error gracefully) or defer the admin UI selector to v1.2?
3. **Currency display:** GBP for UK customers, EUR for EU, USD elsewhere — or single GBP with Stripe conversion at checkout?
4. **Setup fee refundability:** non-refundable from contract signature, or refundable before engineer is assigned?
5. **Mid-contract upgrades:** can a customer upgrade plan band (A→B) or add channels mid-term? How is the pro-rata handled in Stripe?
6. **Demo data geography:** fictional UK postcodes only (Kingston upon Thames, Surbiton, etc. from the existing Data Table sample), or include international examples (Dubai, Singapore) for global prospect appeal?
7. **Custom dashboard domain:** `theircabco.cabbybot.app` subdomain, or CNAME to `app.theircabco.com`?
8. **Renewal model:** auto-renew for 12 months unless cancelled N days before renewal, or convert to rolling monthly at renewal?
9. **n8n editor access:** only senior FlowMo engineering (not all FlowMo admins) gets the internal deeplink to the n8n editor for any tenant's automation?
10. **Brand assets:** CabbyBot logo, colour palette, and typography finalised, or needs design pass first?
11. **Discovery call tool:** Calendly, Cal.com, or HubSpot Meetings?
12. **Marketing-site demo WhatsApp number:** ~£15/month for a dedicated UK number — confirm budget and whether to use a real AutoCab sandbox or full mock responses?

---

## 18. Appendix

### 18.1 Public-Facing Language Guidelines

| ❌ Never say | ✅ Say instead |
|---|---|
| "n8n" | "CabbyBot Automation Engine" |
| "workflow node" | "automation step" |
| "n8n workflow" | "your automation" |
| "execution" | "run" |
| "trigger node" | "channel event" |
| "template" | "your bespoke build" |
| "CabLab" | "CabbyBot" (all surfaces, all assets) |

### 18.2 Dispatch Adapter Comparison

| Capability | AutoCab (v1) | iCabbi (v1.2) | Cordic (v1.2) |
|---|---|---|---|
| Address search | REST, synchronous | REST, synchronous | SOAP, synchronous |
| Quote | Synchronous, fixed or variable fare | Synchronous, fare range | Synchronous |
| Booking create | Synchronous response | Async with polling | Synchronous |
| Flight lookup | Built-in endpoint | External fallback | External fallback |
| LHR terminal routing | Zone ID mapping (proven) | Zone name mapping | To be defined |
| Booking management | Full CRUD | Full CRUD | View + cancel |
| Auth | Subscription key + companyId | API key | API key + secret |

### 18.3 Booking State Machine Flow (Text + Voice Merged)

```
[New message]
      │
      ▼
Get_Session (Data Table lookup by phone)
      │
      ├─ No row → step = "welcome"
      └─ Row found → step = {current step}
                           │
      ┌────────────────────┼──────────────────────────────┐
      │                    │                              │
      ▼                    ▼                              ▼
[messageType=audio]  [messageType=location]      [messageType=text/interactive]
WA Voice Processor   Extract pin (lat/lng)        Parse text intent
  → transcript       → address lookup             → router
  → slot extraction  → slot merge
      │                    │
      └────────────────────┘
                           │
                           ▼
                  [Intent Router — current step × intent]
                           │
          ┌────────────────┼─────────────────────────────┐
          │                │                             │
          ▼                ▼                             ▼
     [book flow]    [airport flow]              [manage flow]
   ask pickup      ask flight number          list bookings
   ask dest        resolve flight             select booking
   ask time        resolve terminal zone      cancel / modify
   ask vehicle     ask buffer / vehicle       update dispatch
   ask name        ask name                   confirm → done
   ask contact     ask contact
   get quote       get quote
   confirm         confirm
   create booking  create booking
   send card       send card
          │
          └────────────────────────────────────────────
                           │
                           ▼
              Write result to Supabase bookings table
              (n8n makes Supabase REST API call or uses
               n8n Supabase node after booking is confirmed)
              + Realtime event → dashboard live feed
```

### 18.4 Pricing Reference Card (Marketing Site)

```
╔═══════════════════════════════════════════════════════════════╗
║                      CABBYBOT PRICING                          ║
║             All prices /month · excl. VAT & taxes              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  OPTION A — Up to 25 Drivers / Fleet                          ║
║  ─────────────────────────────────────                        ║
║  • Single channel        £500   / €500   / $600               ║
║  • Bundle (min 3 ch.)    £1,000 / €1,000 / $1,200             ║
║                                                               ║
║  OPTION B — 26 to 100 Drivers / Fleet                         ║
║  ─────────────────────────────────────                        ║
║  • Single channel        £800   / €800   / $800               ║
║  • Bundle (min 3 ch.)    £1,800 / €1,800 / $2,000             ║
║                                                               ║
║  OPTION C — 101+ Drivers or 4+ channels                       ║
║  ─────────────────────────────────────                        ║
║  • Contact Us                                                 ║
║                                                               ║
║  Plus:                                                        ║
║  • One-time Setup Fee: £1,000 / €1,000 / $1,200               ║
║  • 12-month minimum contract                                  ║
║                                                               ║
║  Booking Bot pricing above. Support Bot, Driver Bot,          ║
║  and custom automations are quoted on demand.                 ║
║                                                               ║
║  Integrated with AutoCab · iCabbi · Cordic                    ║
║                                                               ║
║  You bring your channel numbers. You pay channel fees         ║
║  directly. You own your customers. Always.                    ║
╚═══════════════════════════════════════════════════════════════╝
```

### 18.5 n8n Data Table → Supabase Write Contract

The n8n automation engine writes booking results to Supabase via the Supabase REST API (using the Supabase node or an HTTP Request node with the service role key). This is the contract between the engine and the dashboard:

```typescript
// Payload sent to POST /rest/v1/bookings after a confirmed booking
{
  tenant_id:            string;  // from automation config
  automation_id:        string;  // from automation config
  conversation_id:      string;  // resolved from active conversations table
  channel_type:         string;  // 'whatsapp' | 'telegram' | ...
  dispatch_ref:         string;  // AutoCab booking ID (e.g. "379410")
  dispatch_adapter:     string;  // 'autocab' | 'icabbi' | 'cordic'
  passenger_name:       string;
  customer_handle:      string;  // E.164 phone or telegram ID
  pickup_address:       object;  // full dispatch address JSON
  destination_address:  object;
  vehicle_type:         string;
  passenger_count:      number;
  fare:                 number;
  currency:             string;
  pickup_at_utc:        string;  // ISO 8601
  pickup_time_mode:     string;  // 'ASAP' | 'Fixed'
  airport_json:         object | null;
  driver_note:          string;
  payment_method:       string;
  status:               'confirmed';
  your_reference_1:     string;  // "WA-{phone}"
  your_reference_2:     string;  // vehicle type
  your_reference_3:     string;  // fare string "£14.80"
  raw_dispatch_json:    object;  // full AutoCab response
}
```

Supabase Realtime triggers the dashboard live booking feed update immediately on INSERT.

---

**End of PRD v1.0** · CabbyBot by FlowMo AI LTD · Made in the UK 🇬🇧
