# WhatsApp Chatbot (Chat + Voice Note) — per-tenant template (n8n)

The **Chat** product is one twin n8n workflow pair per tenant: a WhatsApp **Chat**
workflow and the **Voice-Note** sub-workflow it calls to transcribe audio
messages. A WhatsApp voice note is a transcribed audio message that re-enters the
**same** booking state machine — it is **NOT a phone call**. So unlike AI Voice,
the Chat product has **no calling, no Vapi, no call pool, and no per-call credit**.
The dashboard surfaces conversation + booking analytics only.

The reference pair (wired to "Premier Cabs London") is the template to clone:

| Piece | Reference |
|---|---|
| Chat workflow | `bLWWbiAcchP6XCaS` — "Premier-Cab …" (153 booking nodes + the mirror subsystem) |
| Voice-Note sub-workflow | `XlJFrnOXVyMOLqdY` — transcription twin the chat workflow calls for audio |

> The Voice-Note sub-workflow only transcribes and extracts slots, then hands
> back to the main chat workflow (`Apply_Voice_Slots`). Every terminal event
> (quoted / booked / cancelled) therefore flows through the **Chat** workflow, so
> the dashboard mirror lives entirely there — the Voice-Note twin needs no mirror
> nodes of its own.

## How the numbers flow

```
WhatsApp (text or voice note) ──► n8n Chat workflow ──► AutoCab (quote / book / modify / cancel)
                                        │  (voice notes: Execute_Voice → transcribe → Apply_Voice_Slots → rejoin)
                                        │
   At each committed milestone, an ADDITIVE branch fires (off a terminal node,
   AFTER the customer's WhatsApp reply has already been sent):
        ├─ Save_Step_Awaiting_Intent ─► Build_Chat_Open          ─┐ outcome unknown (journey opened)
        ├─ Save_Step_Awaiting_Quote… ─► Build_Chat_Quoted        ─┤ outcome quoted
        ├─ Save_Step_Booked ──────────► Build_Chat_BookedConv    ─┤ outcome booked
        ├─ Send_Cancel_Result ────────► Build_Chat_CancelledConv ─┼─► POST {site}/api/chat/conversations
        ├─ Send_Modify_Result ────────► Build_Chat_ManagedConv   ─┘ outcome cancelled / managed
        ├─ Save_Step_Booked ──────────► Build_Chat_BookedBooking ─┐
        ├─ Send_Cancel_Result ────────► Build_Chat_CancelledBkng ─┤
        └─ Send_Modify_Result ────────► Build_Chat_ManagedBkng   ─┴─► POST {site}/api/chat/bookings
                                        │   (each builder reads BMC Chat Config; empty config → returns [] → no POST)
                                        ▼
   record_chat_conversation / record_chat_booking  (Postgres, SECURITY DEFINER, service_role)
        ├─ conversations  upsert on (tenant_id, conversation_ref)  — outcome never downgrades
        └─ bookings       upsert on (tenant_id, dispatch_ref)      — idempotent re-mirrors
                                        ▼
   Tenant dashboard  /dashboard/chat + Overview   (same rows)
   Admin dashboard   today's bookings / conversations KPI strip (same rows)
```

Every Chat number on the dashboard — conversation volume, booked rate, voice
notes, the bookings feed — is exactly what this pipeline wrote. The dashboard
computes nothing the workflow didn't report.

## The mirror subsystem (already added to the reference workflow)

| Node | Role |
|---|---|
| **BMC Chat Config** | Set node. **The ONLY node edited per tenant.** Holds `site_url`, `tenant_id`, `automation_id`, `chat_ingest_secret`. Fed (dangling) off `Extract_WhatsApp_Data` so it executes on every message and every builder can read it. |
| `Build_Chat_Open` | conversation opened → outcome `unknown` |
| `Build_Chat_Quoted` | quote sent → outcome `quoted` (gated on `Parse_Quote.ok`) |
| `Build_Chat_BookedConv` | booking confirmed → outcome `booked` (gated on `Parse_Booking.status === 'booked'`) |
| `Build_Chat_BookedBooking` | the confirmed dispatch booking row (ref, route, fare, vehicle…) |
| `Build_Chat_CancelledConv` | cancellation → outcome `cancelled` (gated on AutoCab cancel success) |
| `Build_Chat_CancelledBooking` | booking row → status `cancelled` |
| `Build_Chat_ManagedConv` | modify → outcome `managed` (gated on AutoCab modify success) |
| `Build_Chat_ManagedBooking` | booking row → status `modified`, applying the changed fields (`pendingModifyJson`) |
| `POST_Chat_Conversation` / `POST_Chat_Booking` | HTTP POST to the two ingest endpoints, `Authorization: Bearer <chat_ingest_secret>`. `neverError` on. |

### Why this can never break the bot

1. Every tap hangs off a **terminal** node (`Save_Step_*` / `Send_Cancel_Result` /
   `Send_Modify_Result`) that runs **after** the customer's WhatsApp reply was
   already sent. A failing mirror can't skip a sibling branch — there isn't one.
2. The HTTP nodes have **Never Error** on, so a 4xx/5xx is swallowed.
3. With **BMC Chat Config** empty, every builder hits `if (!cfg.tenant_id) return []`
   and posts nothing. The subsystem is **inert until configured** — adding it to a
   live workflow changes no behaviour until you fill the config node.

### conversation_ref + outcome semantics

- `conversation_ref = "<phone>:<UK-date>"`. One journey per phone per day upserts a
  single conversation row whose outcome **advances**: `record_chat_conversation`
  keeps terminal outcomes (`booked`/`managed`/`cancelled`/`abandoned`) and only
  lets `quoted` fill an `unknown`/null — so a late re-quote never downgrades a
  booked conversation.
- `via_voice` is true when the decisive turn arrived as a WhatsApp audio message;
  the RPC ORs it across the journey's mirrors. It drives the dashboard's "Voice
  notes" tile. (It is a usage signal, never a credit/charge.)
- Bookings are keyed on `dispatch_ref` (the AutoCab booking id), so create →
  cancel updates the same row.

## Cloning for a new tenant (runbook)

1. **Admin console** → tenant → Automations → *Add an automation* → pick a Chat
   type (Booking / Support / …). Optionally bind the WhatsApp channel, and paste
   the **Chat workflow ID** + **Voice-Note workflow ID** (reference). 
2. **Clone both n8n workflows** for the tenant; update the per-tenant AutoCab +
   WhatsApp credentials as usual.
3. In the cloned Chat workflow, open **BMC Chat Config** and paste the values
   shown in the admin **Engine wiring — Chat** panel: `site_url`, `tenant_id`,
   `automation_id`, and the deployment's `CHAT_INGEST_SECRET`. (The same values
   serve the Voice-Note twin — it has no mirror nodes of its own.)
4. In **Engine wiring — Chat**, save the workflow id — that takes the bot **live**.
5. Send a test WhatsApp message that completes a booking; it must appear in the
   tenant's `/dashboard/chat` (conversation + booking) within seconds.

## App env

Set `CHAT_INGEST_SECRET` on the deployment (server-only). The chat workflow posts
conversation + booking events with `Authorization: Bearer <CHAT_INGEST_SECRET>`.
Absent/blank → the ingest endpoints reject every request (never accept blindly).

## Mirrored events

`open` (unknown) · `quoted` · `booked` (+ booking row) · `cancelled` (+ booking
row → cancelled) · `managed` (modify; + booking row → modified, applying the
changed fields). All five outcomes plus the live bookings feed are covered.
