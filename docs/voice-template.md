# AI Voice Booking — per-tenant template (n8n + Vapi)

One n8n workflow + one Vapi assistant per tenant. The reference pair (wired to
the demo tenant "Premier Cabs London") is the template to clone:

| Piece | Reference |
|---|---|
| n8n workflow | `0x5hOeCgWfr3N7pR` — "Premier Cab — Vapi Voice Backend" |
| Vapi assistant | `15c5709f-7585-4d39-96cf-ffe85e42bd40` — "Premier Cab — Voice Booking" |

## How the numbers flow

```
Caller ──► Vapi assistant ──(tool calls)──► n8n /webhook/vapi/tools ──► AutoCab
                 │                              (quote / book / modify / cancel / track)
                 │ call ends
                 ▼
   Vapi analysisPlan runs (summary + structuredData.outcome + successEvaluation)
                 │  server message: end-of-call-report  (header x-vapi-secret)
                 ▼
   n8n /webhook/vapi/analytics
     ├─ Analytics Tenant Config   ← the ONLY node edited per tenant
     ├─ Parse End Of Call Report  (secret check, outcome mapping)
     └─ Ingest Call To BookMyCab  → POST {SITE}/api/voice/calls/ingest
                 ▼
   record_voice_call (Postgres, atomic + idempotent on provider_call_id)
     ├─ usage_counters  'voice_calls' monthly pool (allowance from voice_subscriptions)
     ├─ credit_ledger   −1 when the pool is exhausted (top-up credit)
     └─ calls           outcome, duration, credit_source, summary, success
                 ▼
   Tenant dashboard  /dashboard/voice + Overview   (same rows)
   Admin dashboard   platform calls / voice agents (same rows)
```

The dashboard never computes credit itself — every number (pool used/remaining,
plan vs top-up split, outcomes, durations) comes from what this pipeline wrote.

## Vapi assistant — call analysis via Structured Output (required on every clone)

Vapi has DEPRECATED the three separate analysis sections (`summaryPlan`,
`structuredDataPlan`, `successEvaluationPlan`). The pipeline now uses one
unified **Structured Output** instead:

- Reference output: **"BookMyCab Call Report"** (`e71b9220-cdaf-4194-99b9-1d3aac81107e`),
  created via `POST /structured-output`. One schema carries everything the
  dashboard needs: `outcome` (**enum must stay exactly**
  `booked | quoted | abandoned | transferred | failed | unknown` — `no_credit`
  is assigned server-side), `summary` (operator summary), `success` (boolean
  goal evaluation), plus booking facts (`booking_reference`, `pickup`,
  `destination`, `caller_name`, `quoted_fare`).
- Attach it to the assistant: `PATCH /assistant/:id` with
  `artifactPlan.structuredOutputIds: ["<output id>"]`. The SAME output
  definition can be attached to every tenant's assistant — no per-tenant clone
  of the schema needed.
- Plus, as before: `serverMessages: ["end-of-call-report"]`,
  `server.url` = `https://workflow.flowjob.app/webhook/vapi/analytics`,
  `server.secret` = per-tenant secret.

The results arrive in the end-of-call report at
`message.artifact.structuredOutputs[<output id>].result`. The workflow's
`Parse End Of Call Report` node prefers that location and FALLS BACK to the
deprecated `message.analysis.*` fields while Vapi still emits them, so
assistants not yet migrated keep reporting correctly.

## Cloning for a new tenant (runbook)

1. **Admin console** → tenant → Automations → *Add an automation* → type
   "AI Voice agent". Enter the agent phone number (+ plan tier if the tenant has
   no voice plan yet), and — once known — the **Engine workflow ID** and **Vapi
   assistant ID**. Supplying the workflow id activates the agent (status: live).
2. **Clone the n8n workflow**; update the per-tenant AutoCab credentials, then
   open **Analytics Tenant Config** and paste the values shown in the admin
   *Engine wiring — AI Voice* panel:
   `tenant_id`, `automation_id`, `ingest_url`, `authorize_url`, the
   deployment's `VOICE_INGEST_SECRET`, a fresh `vapi_webhook_secret`, and the
   tenant's `vapi_assistant_id`.
3. **Duplicate the Vapi assistant**; point its tools at the cloned workflow's
   `/webhook/vapi/tools` URL, and set `server.url`/`server.secret`/`analysisPlan`
   as above (secret = the one pasted into the n8n config node).
4. Publish the n8n workflow. Make a test call; the call must appear in the
   tenant's `/dashboard/voice` within seconds of hang-up.

## Credit enforcement — the two kill switches

Metering alone is post-call accounting; these two gates STOP service at
exhaustion (e.g. Ignition call 1,501 with no top-up credit):

1. **Layer 1 — tool gate (in-call).** Every tool call passes the `Credit Gate`
   node, which asks `POST {SITE}/api/voice/calls/authorize` whether the next
   call is payable (pool headroom OR top-up credit, mirroring
   `record_voice_call`'s charging order). When blocked, the agent receives a
   SYSTEM tool result telling it to apologise and end the call — no quote, no
   booking.
2. **Layer 2 — pre-answer gate (per phone number).** Configure the tenant's
   Vapi **phone number** with `server.url =
   https://workflow.flowjob.app/webhook/vapi/assistant-request` + the tenant's
   webhook secret, and leave `assistantId` **unset** on the number. Vapi then
   asks the workflow which assistant should take each inbound call: with credit
   it returns the tenant's assistant; exhausted, it returns an error and the
   call is rejected **before the assistant answers** (zero LLM/voice cost).
   Recovery is automatic — the next call after a top-up or monthly reset gets
   the assistant again. No disable/enable state to manage.

Both gates **fail open**: if the BookMyCab gate endpoint is unreachable, calls
proceed and the meter still records them post-call — an app outage must never
take every tenant's phone line down.

Stripe's role is unchanged: it never sees call volume. It collects the fixed
subscription + credit top-ups; `invoice.paid` resets the monthly pool.

## Guarantees

- **Idempotent**: Vapi retries are safe — `record_voice_call` dedupes on
  `provider_call_id`.
- **Authenticated twice**: Vapi→n8n via `x-vapi-secret`; n8n→app via
  `Authorization: Bearer VOICE_INGEST_SECRET`.
- **Race-safe metering**: a per-tenant advisory lock serializes pool/credit
  consumption.

## Known deployment note

`https://bookmycab.io` must be redeployed with the current `main`/branch build —
the live deploy predates `/api/voice/calls/ingest` (verified 404 on 2026-06-12).
Until then the ingest hop fails in the n8n execution log (and the workflow run
shows an error); everything upstream is live.
