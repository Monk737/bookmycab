# B5 — Voice Call Metering Implementation Plan

> Execution: controller handles the migration + Supabase-branch function test via MCP (append-only tables can't be safely tested on prod); a subagent handles the TypeScript (env + endpoint + auth + tests). Spec: `docs/superpowers/specs/2026-06-11-b5-voice-call-metering-design.md`.

**Goal:** A `POST /api/voice/calls/ingest` endpoint (bearer-auth) that calls a race-safe, idempotent `record_voice_call` Postgres function implementing the plan-pool-then-top-up draw order.

**Depends on:** R1/B1 schema (live), B3 pool reset (live).

---

## Task 1 — Migration 0044 (controller, MCP)
- Create `supabase/migrations/0044_voice_call_metering.sql` (exact SQL from the spec: `calls.provider_call_id` + unique index + `record_voice_call` function + grants).
- Create a Supabase dev branch; apply `0044` there.
- Verify the draw order on the branch via `execute_sql`:
  1. Seed a test tenant + `voice_subscriptions` (allowance 2) + 2 credits in `credit_ledger`.
  2. Call `record_voice_call` 2× → both `credit_source='plan'`; `usage_counters.used`=2; 2 `usage_events`.
  3. Call 2× more → both `credit_source='topup'`; 2 `credit_ledger` `-1` rows; balance 0.
  4. Call again → `credit_source='none'`, `outcome='no_credit'`, `credit_charged=0`.
  5. Re-send a used `provider_call_id` → `duplicate=true`, no new charge.
- On success: apply `0044` to the main project; delete the branch.
- Add static migration test `tests/voice-metering-migration.test.ts` (regex over the `.sql`).

## Task 2 — env var (subagent)
- Add `VOICE_INGEST_SECRET` to `src/env.ts` server schema (required). Match the existing env-var pattern.

## Task 3 — ingest endpoint + auth helper + tests (subagent)
- `src/lib/voice/ingest-auth.ts` (pure): `bearerMatches(header: string | null, secret: string): boolean` — constant-time compare; false on absent/malformed.
- `src/app/api/voice/calls/ingest/route.ts`: `POST` — bearer check (401), zod body validation (400), `serviceClient.rpc('record_voice_call', {...})`, return 200 with the result; `runtime='nodejs'`.
- `tests/voice-ingest.test.ts`: auth helper (match/mismatch/absent/timing-safe), and the route's validation + rpc-call shape with mocked env + mocked Supabase rpc.
- Verify: `tsc`, lint, `npm run build`.

## Acceptance
Per the spec's 6 criteria. Function draw order verified on a branch; endpoint auth/validation unit-tested; build clean.
