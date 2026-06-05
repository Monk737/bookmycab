# Epic 5 — Automation Engine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (implementer → spec review → quality review per task). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the inbound webhook gateway (5 channels: verify signature → resolve automation → dedupe → rate-limit → forward to the engine → 200 in p95 ≤300ms), the internal n8n engine client (start/stop/restart/status/runs), and the tenant-facing Automation Control API wired to that client with status sync and audit logging.

**Architecture:** A Next.js Route Handler edge gateway at `/webhooks/:channel/:automationId` verifies each provider's signature, resolves the automation (Supabase, cached in Redis 5-min TTL), dedupes on the provider message id (Redis idempotency, 24h TTL), enforces a per-automation+channel rate limit (Redis fixed-window), then **fire-and-forgets** the payload to the automation's n8n webhook URL and returns 200 immediately (the engine processes async). The Control API (`/api/orgs/:orgId/automations/:automationId/*`) calls the n8n public REST API to activate/deactivate workflows and read executions, mirrors the resulting status into `automations.status`, and writes an `audit_log` row per control action. **Live infrastructure is required** — a real n8n instance and a real Redis (via the Upstash REST protocol) run locally in Docker and in CI, exactly as Supabase already does.

**Tech Stack:** Next.js 15 Route Handlers · `@upstash/redis` (REST client; works on Vercel serverless) · n8n public REST API (`X-N8N-API-KEY`) · `@supabase/supabase-js` service-role · Node `crypto` (HMAC signature verify) · Vitest (unit + live integration) · zod · Docker Compose (local n8n + `serverless-redis-http` fronting Redis).

**Brand rule:** "n8n"/"workflow"/"execution" must NEVER appear on any customer-facing surface. The Control API returns neutral fields ("BookMyCab Automation Engine", `status`, `runs`); n8n vocabulary stays inside `src/lib/engine/**` (server-only) and is never surfaced in API responses or error messages shown to tenants.

**Prerequisites:** Epics 1–4 merged to `master` (they are). Local Supabase via colima on :54322. Build on branch `epic-5-engine` (create off `master`). **Run `pnpm test`/`vitest`, `supabase`, and `docker`/`docker compose` from the main shell with `dangerouslyDisableSandbox: true`** (the sandbox hangs external binaries; subagents run unsandboxed).

---

## Infrastructure note (read before Task 1)

This epic needs two live services in addition to Supabase:

1. **Redis via the Upstash REST protocol.** Production uses Upstash. Locally we run a real Redis plus [`serverless-redis-http` (SRH)](https://github.com/hiett/serverless-redis-http), which speaks the Upstash REST protocol so `@upstash/redis` works unchanged against `http://localhost:8079`. This avoids a second client library and keeps local == prod.
2. **n8n** (`n8nio/n8n` image) with the public REST API enabled and an API key, reachable at `http://localhost:5678`.

Both run via a committed `docker-compose.engine.yml`. Integration tests (Tasks 2, 6) connect to these and are **skipped with a clear warning** when their env vars are absent, so a contributor without the stack can still run the unit suite — but the executor of this plan MUST bring the stack up (`docker compose -f docker-compose.engine.yml up -d`) and the CI workflow must start it (mirroring the existing `supabase start` gate). Pure logic (Tasks 3, 4 verify/resolve) is unit-tested and needs no infra.

---

## File structure (created/modified by this epic)

```
docker-compose.engine.yml                 # local n8n + redis + serverless-redis-http (SRH)
.env.example                              # MODIFY: N8N_*, UPSTASH_* documented for local
src/env.ts                                # MODIFY: N8N_BASE_URL/API_KEY, UPSTASH_*, IDEMPOTENCY_TTL_SEC, CHANNEL_CACHE_TTL_SEC
supabase/migrations/
  0012_automation_engine_webhook_url.sql  # automations.engine_webhook_url (nullable)
  0013_webhook_verify_credential_types.sql# extend channel_credentials.credential_type CHECK with verify secrets
src/lib/redis/
  client.ts                               # Upstash REST client singleton (server-only)
  cache.ts                                # getOrSet<T>(key, ttl, loader) + del
  idempotency.ts                          # claimOnce(key, ttl) -> boolean (first-seen)
  rate-limit.ts                           # fixedWindow(key, limit, windowSec) -> { allowed, remaining }
src/lib/webhooks/
  signatures.ts                           # pure: verifyMeta/ verifyTelegram/ verifyWidget + verifyChannelSignature dispatch
  resolver.ts                             # resolveAutomation(automationId) w/ Redis cache + Supabase loader
  forward.ts                              # fireAndForgetForward(engineWebhookUrl, headers, rawBody)
  message-id.ts                           # pure: extractProviderMessageId(channel, parsedBody) for idempotency
src/lib/engine/
  client.ts                               # n8n REST client: activate/deactivate/getWorkflow/listExecutions/getExecution (injectable fetch)
  control.ts                              # startAutomation/stopAutomation/restartAutomation/getStatus/listRuns (maps engine->Supabase status, audits)
  types.ts                               # neutral status/run types returned to the API layer
src/lib/audit.ts                          # MOVE/GENERALIZE: re-export writeAudit (shared by admin + control plane)
src/app/webhooks/[channel]/[automationId]/route.ts   # the gateway (GET verify + POST inbound)
src/app/api/orgs/[orgId]/automations/[automationId]/start/route.ts
src/app/api/orgs/[orgId]/automations/[automationId]/stop/route.ts
src/app/api/orgs/[orgId]/automations/[automationId]/restart/route.ts
src/app/api/orgs/[orgId]/automations/[automationId]/status/route.ts
src/app/api/orgs/[orgId]/automations/[automationId]/runs/route.ts
src/lib/api/guard.ts                      # requireOrgAccess(orgId, {minRole}) -> claims | NextResponse(403)
tests/
  webhook-signatures.test.ts              # pure HMAC/token verify per channel
  webhook-message-id.test.ts              # pure provider-message-id extraction
  webhook-resolver.test.ts                # resolver cache hit/miss/negative (mocked redis + supabase)
  redis-integration.test.ts               # LIVE: cache/idempotency/rate-limit against SRH (skips if no env)
  engine-client.integration.test.ts       # LIVE: activate/deactivate/executions against n8n (skips if no env)
  engine-control.test.ts                  # control.ts maps engine->status + audits (mocked client)
  api-guard.test.ts                        # requireOrgAccess role/tenant matrix (pure-ish)
  webhook-gateway.test.ts                  # route: verify→resolve→dedupe→ratelimit→forward→200 (mocked deps, jsdom-free node)
.github/workflows/ci.yml                  # MODIFY: start docker-compose.engine.yml before tests
```

**Responsibility boundaries:** signature verification, provider-message-id extraction, and the resolver decision are pure/unit-tested. Redis primitives and the n8n client are thin wrappers integration-tested against live services. The gateway route and control layer are orchestration, tested with the wrappers mocked (node environment, no jsdom). Everything under `src/lib/engine/**` and `src/lib/redis/**` and the webhook libs is server-only.

---

## Task 1: Infra, deps, env, and schema

**Files:**
- Create: `docker-compose.engine.yml`
- Modify: `.env.example`, `src/env.ts`
- Create: `supabase/migrations/0012_automation_engine_webhook_url.sql`, `supabase/migrations/0013_webhook_verify_credential_types.sql`
- Add deps: `@upstash/redis`

- [ ] **Step 1: Add the Redis dependency**

Run: `pnpm add @upstash/redis`
Expected: `@upstash/redis` appears in `package.json` dependencies; `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write `docker-compose.engine.yml`**

```yaml
# Local BookMyCab Automation Engine + Redis stack.
# Brings up: n8n (REST API), redis, and serverless-redis-http (SRH) so the
# Upstash REST client works locally against real redis.
#   docker compose -f docker-compose.engine.yml up -d
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: ["redis-server", "--save", "", "--appendonly", "no"]

  serverless-redis-http:
    image: hiett/serverless-redis-http:latest
    ports: ["8079:80"]
    environment:
      SRH_MODE: env
      SRH_TOKEN: local-dev-srh-token
      SRH_CONNECTION_STRING: "redis://redis:6379"
    depends_on: [redis]

  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      N8N_PUBLIC_API_DISABLED: "false"
      N8N_ENCRYPTION_KEY: local-dev-n8n-encryption-key
      DB_TYPE: sqlite
      N8N_DIAGNOSTICS_ENABLED: "false"
      N8N_PERSONALIZATION_ENABLED: "false"
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

- [ ] **Step 3: Document env in `.env.example`**

Append under the existing engine/Redis groups (do not duplicate keys already present):

```bash
# Automation engine (n8n) — internal only, never exposed to customers.
# Local: docker-compose.engine.yml exposes n8n at http://localhost:5678.
# Generate an API key in n8n Settings → n8n API, then set:
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=

# Redis (Upstash REST). Local: serverless-redis-http (SRH) from docker-compose.engine.yml.
UPSTASH_REDIS_REST_URL=http://localhost:8079
UPSTASH_REDIS_REST_TOKEN=local-dev-srh-token

# Gateway tuning
CHANNEL_CACHE_TTL_SEC=300        # channel→automation resolver cache TTL (PRD: 5 min)
IDEMPOTENCY_TTL_SEC=86400        # inbound message dedupe window (24h)
```

- [ ] **Step 4: Extend `src/env.ts`**

In the zod `schema` object add (keep existing entries; `N8N_BASE_URL`, `N8N_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` already exist as optional — leave their optionality, they're only required at runtime when the gateway/engine is exercised):

```ts
  // Gateway tuning (defaults match PRD §7 + Epic 5).
  CHANNEL_CACHE_TTL_SEC: z.coerce.number().int().positive().default(300),
  IDEMPOTENCY_TTL_SEC: z.coerce.number().int().positive().default(86400),
```

Leave `N8N_*` and `UPSTASH_*` as the existing `.optional()` — the gateway/engine modules throw a clear error at call time if they're missing (Step in Task 2/6), so build/typecheck without infra still passes.

- [ ] **Step 5: Migration `0012_automation_engine_webhook_url.sql`**

```sql
-- The engine (n8n) webhook URL the gateway forwards inbound channel events to.
-- One per automation; set at provisioning/build time. Internal only — never
-- surfaced to tenants. Nullable: an automation in build_stage Requested/Scoped
-- has no engine webhook yet.
alter table public.automations
  add column engine_webhook_url text;

comment on column public.automations.engine_webhook_url is
  'Internal n8n webhook URL the edge gateway forwards channel events to. Never exposed to customers.';
```

- [ ] **Step 6: Migration `0013_webhook_verify_credential_types.sql`**

The gateway needs each channel's inbound-verify secret (Meta app secret, Telegram webhook secret token, widget signing key), stored in the Epic-3 vault alongside the send tokens. Extend the `credential_type` CHECK:

```sql
-- Inbound webhook verification secrets live in the same vault as send tokens.
-- Extend the credential_type allow-list (Epic 3 migration 0008/0009 set the
-- original send-token set). Drop + re-add the CHECK constraint.
alter table public.channel_credentials
  drop constraint if exists channel_credentials_credential_type_check;

alter table public.channel_credentials
  add constraint channel_credentials_credential_type_check
  check (credential_type in (
    -- send tokens (existing)
    'whatsapp_token','telegram_token','messenger_token','instagram_token','widget_secret',
    -- inbound verify secrets (new in Epic 5)
    'meta_app_secret','telegram_webhook_secret','widget_signing_key','meta_verify_token'
  ));
```

- [ ] **Step 7: Apply migrations and verify**

Run: `supabase db reset`
Expected: migrations `0001`–`0013` all apply; final line `Finished supabase db reset`. Confirm the new column:
Run: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -tAc "select column_name from information_schema.columns where table_name='automations' and column_name='engine_webhook_url'"`
Expected: `engine_webhook_url`

- [ ] **Step 8: Bring up the engine stack and verify reachability**

Run: `docker compose -f docker-compose.engine.yml up -d`
Then: `curl -s -X POST http://localhost:8079/set/epic5ping/ok -H "Authorization: Bearer local-dev-srh-token"` → expect `{"result":"OK"}`; `curl -s http://localhost:5678/healthz` → expect a 200/JSON healthz body.
If n8n needs an API key: open `http://localhost:5678`, create the owner account, Settings → n8n API → create key, put it in `.env.local` as `N8N_API_KEY`. (Document this as a one-time local setup step in the commit body.)

- [ ] **Step 9: Verify the app still builds/types/tests with the new env + deps**

Run: `pnpm typecheck && pnpm test` → Expected: clean / all existing tests pass (240 baseline).

- [ ] **Step 10: Commit**

```bash
git add docker-compose.engine.yml .env.example src/env.ts \
  supabase/migrations/0012_automation_engine_webhook_url.sql \
  supabase/migrations/0013_webhook_verify_credential_types.sql \
  package.json pnpm-lock.yaml
git commit -m "feat(engine): infra (n8n+redis docker), env, engine_webhook_url + verify-secret vault types"
```

---

## Task 2: Redis primitives (cache, idempotency, rate-limit) — live integration

**Files:**
- Create: `src/lib/redis/client.ts`, `src/lib/redis/cache.ts`, `src/lib/redis/idempotency.ts`, `src/lib/redis/rate-limit.ts`
- Test: `tests/redis-integration.test.ts`

- [ ] **Step 1: Redis client singleton**

`src/lib/redis/client.ts`:

```ts
import "server-only";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

let client: Redis | null = null;

/** Lazily constructs the Upstash REST Redis client. Throws if unconfigured. */
export function getRedis(): Redis {
  if (client) return client;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN).");
  }
  client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return client;
}

/** True when Redis env is present (used to skip integration tests cleanly). */
export function isRedisConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
```

- [ ] **Step 2: Cache helper**

`src/lib/redis/cache.ts`:

```ts
import "server-only";
import { getRedis } from "./client";

/**
 * Returns the cached JSON value for `key`, or runs `loader`, caches the result
 * for `ttlSec`, and returns it. `null` results from the loader are cached too
 * (negative caching) to avoid hammering the DB for unknown keys.
 */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  const cached = await redis.get<T>(key);
  if (cached !== null && cached !== undefined) return cached;
  const value = await loader();
  // @upstash/redis JSON-serialises automatically; store with TTL.
  await redis.set(key, value, { ex: ttlSec });
  return value;
}

export async function del(key: string): Promise<void> {
  await getRedis().del(key);
}
```

- [ ] **Step 3: Idempotency helper**

`src/lib/redis/idempotency.ts`:

```ts
import "server-only";
import { getRedis } from "./client";

/**
 * Atomically claims `key` if unseen. Returns true the FIRST time (caller should
 * process), false if already claimed within `ttlSec` (caller should skip).
 * Uses SET NX EX so the check-and-set is atomic on the Redis side.
 */
export async function claimOnce(key: string, ttlSec: number): Promise<boolean> {
  const res = await getRedis().set(key, "1", { nx: true, ex: ttlSec });
  return res === "OK";
}
```

- [ ] **Step 4: Rate-limit helper**

`src/lib/redis/rate-limit.ts`:

```ts
import "server-only";
import { getRedis } from "./client";

export type RateResult = { allowed: boolean; remaining: number };

/**
 * Fixed-window counter: increments `key`, sets the window TTL on first hit,
 * allows while count <= limit. Coarser than a sliding window but cheap and
 * sufficient for per-automation+channel webhook throttling (PRD §7 gateway).
 */
export async function fixedWindow(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateResult> {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
```

- [ ] **Step 5: Write the live integration test**

`tests/redis-integration.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { isRedisConfigured } from "@/lib/redis/client";
import { getOrSet, del } from "@/lib/redis/cache";
import { claimOnce } from "@/lib/redis/idempotency";
import { fixedWindow } from "@/lib/redis/rate-limit";

const run = isRedisConfigured() ? describe : describe.skip;

run("redis primitives (live SRH)", () => {
  const uniq = `epic5test:${Date.now()}`;

  it("getOrSet caches the loader result and serves it on the second call", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { n: calls };
    };
    const a = await getOrSet(`${uniq}:cache`, 30, loader);
    const b = await getOrSet(`${uniq}:cache`, 30, loader);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 }); // served from cache, loader not re-run
    expect(calls).toBe(1);
    await del(`${uniq}:cache`);
  });

  it("claimOnce returns true once then false within the window", async () => {
    const first = await claimOnce(`${uniq}:idem`, 30);
    const second = await claimOnce(`${uniq}:idem`, 30);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("fixedWindow allows up to the limit then denies", async () => {
    const k = `${uniq}:rate`;
    const r1 = await fixedWindow(k, 2, 30);
    const r2 = await fixedWindow(k, 2, 30);
    const r3 = await fixedWindow(k, 2, 30);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });
});
```

- [ ] **Step 6: Run the integration test (stack must be up)**

Run: `docker compose -f docker-compose.engine.yml up -d` (if not already) then `pnpm test tests/redis-integration.test.ts`
Expected: 3 passed. (If env is absent the suite is `describe.skip` and reports skipped — but for this task it MUST run green, so ensure `.env.local` has `UPSTASH_REDIS_REST_URL=http://localhost:8079` and `UPSTASH_REDIS_REST_TOKEN=local-dev-srh-token`.)

- [ ] **Step 7: Verify full suite + typecheck**

Run: `pnpm typecheck && pnpm test` → Expected: clean; existing 240 + 3 new pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/redis tests/redis-integration.test.ts
git commit -m "feat(engine): redis cache/idempotency/rate-limit primitives + live integration test"
```

---

## Task 3: Per-channel signature verification (pure, TDD)

**Files:**
- Create: `src/lib/webhooks/signatures.ts`
- Test: `tests/webhook-signatures.test.ts`

Background (verification mechanism per provider):
- **Meta (WhatsApp / Messenger / Instagram):** POST carries header `x-hub-signature-256: sha256=<hex>` = `HMAC_SHA256(appSecret, rawBody)`. GET subscription handshake carries `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`; echo the challenge when the token matches.
- **Telegram:** no body HMAC. At `setWebhook` time a `secret_token` is registered; each POST carries header `x-telegram-bot-api-secret-token`; compare constant-time.
- **Widget:** BookMyCab-issued. POST carries header `x-cabby-signature: <hex>` = `HMAC_SHA256(widgetSigningKey, rawBody)`.

- [ ] **Step 1: Write the failing tests**

`tests/webhook-signatures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyMetaSignature,
  verifyTelegramSecret,
  verifyWidgetSignature,
  verifyMetaSubscribe,
} from "@/lib/webhooks/signatures";

const rawBody = JSON.stringify({ hello: "world" });

describe("verifyMetaSignature", () => {
  const appSecret = "meta-app-secret";
  const good = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");

  it("accepts a correct sha256 signature", () => {
    expect(verifyMetaSignature(rawBody, good, appSecret)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyMetaSignature(rawBody + "x", good, appSecret)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifyMetaSignature(rawBody, good, "other")).toBe(false);
  });
  it("rejects a missing/empty header", () => {
    expect(verifyMetaSignature(rawBody, "", appSecret)).toBe(false);
    expect(verifyMetaSignature(rawBody, null, appSecret)).toBe(false);
  });
  it("rejects a malformed header (no sha256= prefix)", () => {
    expect(verifyMetaSignature(rawBody, "deadbeef", appSecret)).toBe(false);
  });
});

describe("verifyTelegramSecret", () => {
  it("accepts a matching secret token (constant-time)", () => {
    expect(verifyTelegramSecret("abc123", "abc123")).toBe(true);
  });
  it("rejects a mismatch and empty/null", () => {
    expect(verifyTelegramSecret("abc123", "nope")).toBe(false);
    expect(verifyTelegramSecret("", "abc123")).toBe(false);
    expect(verifyTelegramSecret(null, "abc123")).toBe(false);
  });
});

describe("verifyWidgetSignature", () => {
  const key = "widget-signing-key";
  const good = createHmac("sha256", key).update(rawBody).digest("hex");
  it("accepts a correct hex signature", () => {
    expect(verifyWidgetSignature(rawBody, good, key)).toBe(true);
  });
  it("rejects tampered/empty", () => {
    expect(verifyWidgetSignature(rawBody, good, "other")).toBe(false);
    expect(verifyWidgetSignature(rawBody, "", key)).toBe(false);
  });
});

describe("verifyMetaSubscribe", () => {
  it("returns the challenge when mode+token match", () => {
    expect(
      verifyMetaSubscribe(
        { "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "12345" },
        "vt",
      ),
    ).toBe("12345");
  });
  it("returns null on token mismatch or wrong mode", () => {
    expect(
      verifyMetaSubscribe(
        { "hub.mode": "subscribe", "hub.verify_token": "bad", "hub.challenge": "1" },
        "vt",
      ),
    ).toBeNull();
    expect(
      verifyMetaSubscribe(
        { "hub.mode": "unsubscribe", "hub.verify_token": "vt", "hub.challenge": "1" },
        "vt",
      ),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test tests/webhook-signatures.test.ts`
Expected: FAIL — module `@/lib/webhooks/signatures` not found.

- [ ] **Step 3: Implement `signatures.ts`**

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string compare; false on length mismatch or null. */
function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Meta (WhatsApp/Messenger/Instagram): x-hub-signature-256: sha256=<hmac hex>. */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header, expected);
}

/** Telegram: x-telegram-bot-api-secret-token matches the registered secret. */
export function verifyTelegramSecret(
  header: string | null | undefined,
  expectedSecret: string,
): boolean {
  return safeEqual(header, expectedSecret);
}

/** Widget: x-cabby-signature: <hmac hex> over the raw body. */
export function verifyWidgetSignature(
  rawBody: string,
  header: string | null | undefined,
  signingKey: string,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", signingKey).update(rawBody).digest("hex");
  return safeEqual(header, expected);
}

/** Meta GET subscription handshake: echo hub.challenge iff token matches. */
export function verifyMetaSubscribe(
  query: Record<string, string | undefined>,
  expectedVerifyToken: string,
): string | null {
  if (
    query["hub.mode"] === "subscribe" &&
    safeEqual(query["hub.verify_token"], expectedVerifyToken)
  ) {
    return query["hub.challenge"] ?? null;
  }
  return null;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm test tests/webhook-signatures.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/webhooks/signatures.ts tests/webhook-signatures.test.ts
git commit -m "feat(engine): per-channel webhook signature verification (Meta/Telegram/Widget)"
```

---

## Task 4: Provider-message-id extraction + channel→automation resolver

**Files:**
- Create: `src/lib/webhooks/message-id.ts`, `src/lib/webhooks/resolver.ts`
- Test: `tests/webhook-message-id.test.ts`, `tests/webhook-resolver.test.ts`

- [ ] **Step 1: Failing test for message-id extraction**

`tests/webhook-message-id.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractProviderMessageId } from "@/lib/webhooks/message-id";

describe("extractProviderMessageId", () => {
  it("whatsapp: messages[0].id", () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.ABC" }] } }] }] };
    expect(extractProviderMessageId("whatsapp", body)).toBe("wamid.ABC");
  });
  it("messenger/instagram: entry[0].messaging[0].message.mid", () => {
    const body = { entry: [{ messaging: [{ message: { mid: "m_123" } }] }] };
    expect(extractProviderMessageId("messenger", body)).toBe("m_123");
    expect(extractProviderMessageId("instagram", body)).toBe("m_123");
  });
  it("telegram: update_id", () => {
    expect(extractProviderMessageId("telegram", { update_id: 4242 })).toBe("4242");
  });
  it("widget: messageId", () => {
    expect(extractProviderMessageId("widget", { messageId: "w-9" })).toBe("w-9");
  });
  it("returns null when the id is absent (caller falls back to no-dedupe)", () => {
    expect(extractProviderMessageId("whatsapp", {})).toBeNull();
    expect(extractProviderMessageId("telegram", {})).toBeNull();
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm test tests/webhook-message-id.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `message-id.ts`**

```ts
import "server-only";

export type Channel = "whatsapp" | "telegram" | "messenger" | "instagram" | "widget";

/**
 * Pulls the provider's unique message/update id from a parsed inbound body, used
 * as the idempotency key. Returns null when not found — the caller then forwards
 * without dedupe rather than dropping the event.
 */
export function extractProviderMessageId(channel: Channel, body: unknown): string | null {
  const b = body as Record<string, unknown>;
  try {
    switch (channel) {
      case "whatsapp": {
        const v = (b.entry as any)?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
        return typeof v === "string" ? v : null;
      }
      case "messenger":
      case "instagram": {
        const v = (b.entry as any)?.[0]?.messaging?.[0]?.message?.mid;
        return typeof v === "string" ? v : null;
      }
      case "telegram": {
        const v = (b as any).update_id;
        return v != null ? String(v) : null;
      }
      case "widget": {
        const v = (b as any).messageId;
        return typeof v === "string" ? v : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Confirm pass**

Run: `pnpm test tests/webhook-message-id.test.ts` → Expected: PASS.

- [ ] **Step 5: Failing test for the resolver**

`tests/webhook-resolver.test.ts` (mocks the Redis cache + the Supabase loader so it's pure-ish and needs no infra):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getOrSet = vi.fn();
vi.mock("@/lib/redis/cache", () => ({ getOrSet: (...a: unknown[]) => getOrSet(...a) }));

const loadAutomationFromDb = vi.fn();
vi.mock("@/lib/webhooks/resolver-loader", () => ({
  loadAutomationFromDb: (...a: unknown[]) => loadAutomationFromDb(...a),
}));

import { resolveAutomation } from "@/lib/webhooks/resolver";

beforeEach(() => {
  getOrSet.mockReset();
  loadAutomationFromDb.mockReset();
});

describe("resolveAutomation", () => {
  it("returns the cached/loaded record and keys the cache by automation id", async () => {
    const rec = {
      automationId: "a1",
      tenantId: "t1",
      status: "live",
      engineWebhookUrl: "http://engine/webhook/a1",
    };
    getOrSet.mockImplementation(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader());
    loadAutomationFromDb.mockResolvedValue(rec);

    const out = await resolveAutomation("a1");
    expect(out).toEqual(rec);
    expect(getOrSet).toHaveBeenCalledWith("automation:a1", 300, expect.any(Function));
  });

  it("returns null for an unknown automation (negative result is cacheable)", async () => {
    getOrSet.mockImplementation(async (_k, _t, loader) => loader());
    loadAutomationFromDb.mockResolvedValue(null);
    expect(await resolveAutomation("ghost")).toBeNull();
  });
});
```

- [ ] **Step 6: Confirm failure**

Run: `pnpm test tests/webhook-resolver.test.ts` → Expected: FAIL (modules not found).

- [ ] **Step 7: Implement the resolver + its DB loader**

`src/lib/webhooks/resolver-loader.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export type ResolvedAutomation = {
  automationId: string;
  tenantId: string;
  status: string; // building | uat | live | stopped | error
  engineWebhookUrl: string | null;
};

/** Service-role read: the gateway is unauthenticated, RLS would block it. */
export async function loadAutomationFromDb(
  automationId: string,
): Promise<ResolvedAutomation | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("automations")
    .select("id, tenant_id, status, engine_webhook_url")
    .eq("id", automationId)
    .maybeSingle();
  if (!data) return null;
  return {
    automationId: data.id,
    tenantId: data.tenant_id,
    status: data.status,
    engineWebhookUrl: data.engine_webhook_url,
  };
}
```

`src/lib/webhooks/resolver.ts`:

```ts
import "server-only";
import { getOrSet } from "@/lib/redis/cache";
import { env } from "@/env";
import { loadAutomationFromDb, type ResolvedAutomation } from "./resolver-loader";

/**
 * Resolves an automation id to its tenant/status/engine URL, cached in Redis for
 * CHANNEL_CACHE_TTL_SEC (PRD: 5 min). Negative results (null) are cached too so a
 * flood to an unknown id doesn't hammer the DB.
 */
export async function resolveAutomation(
  automationId: string,
): Promise<ResolvedAutomation | null> {
  return getOrSet<ResolvedAutomation | null>(
    `automation:${automationId}`,
    env.CHANNEL_CACHE_TTL_SEC,
    () => loadAutomationFromDb(automationId),
  );
}
```

- [ ] **Step 8: Confirm pass + full suite**

Run: `pnpm test tests/webhook-resolver.test.ts tests/webhook-message-id.test.ts` → Expected: PASS.
Run: `pnpm typecheck` → Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/lib/webhooks/message-id.ts src/lib/webhooks/resolver.ts src/lib/webhooks/resolver-loader.ts \
  tests/webhook-message-id.test.ts tests/webhook-resolver.test.ts
git commit -m "feat(engine): provider message-id extraction + cached channel→automation resolver"
```

---

## Task 5: Webhook gateway route handler

**Files:**
- Create: `src/lib/webhooks/forward.ts`, `src/app/webhooks/[channel]/[automationId]/route.ts`
- Test: `tests/webhook-gateway.test.ts`
- Verify: `src/middleware/access.ts` already treats `/webhooks` as a public prefix (it does — no change; confirm in Step 6).

The gateway reads the channel's verify secret from the Epic-3 vault. Credential lookup: `channel_credentials` rows for the automation's channel of this type, read via `vault_read_credential_rpc`. To keep Task 5 focused, add a small server helper `getChannelVerifySecret(automationId, channel)` inside `forward.ts`'s sibling — but per the file plan, put vault access in `resolver-loader.ts` as `loadChannelVerifySecret`. (Defined in Step 2 below.)

- [ ] **Step 1: `forward.ts` — fire-and-forget forwarder**

```ts
import "server-only";

/**
 * Forwards the raw inbound payload to the engine webhook URL WITHOUT awaiting the
 * engine's processing — the gateway must return 200 in p95 ≤300ms (PRD §11). We
 * start the request and attach a catch so a slow/failed engine never rejects the
 * caller. Returns immediately.
 */
export function fireAndForgetForward(
  engineWebhookUrl: string,
  contentType: string,
  rawBody: string,
): void {
  // Intentionally not awaited.
  void fetch(engineWebhookUrl, {
    method: "POST",
    headers: { "content-type": contentType },
    body: rawBody,
  }).catch((err) => {
    console.error("engine forward failed", { engineWebhookUrl, err: String(err) });
  });
}
```

- [ ] **Step 2: Add the vault verify-secret loader**

Append to `src/lib/webhooks/resolver-loader.ts`:

```ts
/** Reads the inbound-verify secret for a channel from the Epic-3 vault. */
export async function loadChannelVerifySecret(
  automationId: string,
  credentialType: string,
): Promise<string | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  // Find the channel_credentials row id for this automation's channel + type,
  // then decrypt via the key-param RPC wrapper (Epic 3 migration 0010).
  const { data: cred } = await supabase
    .from("channel_credentials")
    .select("id, channels!inner(automation_id)")
    .eq("credential_type", credentialType)
    .eq("channels.automation_id", automationId)
    .maybeSingle();
  if (!cred) return null;
  const { data: secret, error } = await supabase.rpc("vault_read_credential_rpc", {
    p_id: (cred as { id: string }).id,
    p_accessed_by: null,
    p_key: env.SUPABASE_VAULT_KEY,
  });
  if (error) return null;
  return (secret as string) ?? null;
}
```

(Note: `p_accessed_by` is null — the gateway is an automated system actor, not a staff user; consistent with the Epic 3/4 nullable-actor pattern. The vault read is still recorded via `last_accessed_at`.)

- [ ] **Step 3: The route handler**

`src/app/webhooks/[channel]/[automationId]/route.ts`:

```ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import {
  verifyMetaSignature,
  verifyTelegramSecret,
  verifyWidgetSignature,
  verifyMetaSubscribe,
} from "@/lib/webhooks/signatures";
import { extractProviderMessageId, type Channel } from "@/lib/webhooks/message-id";
import { resolveAutomation } from "@/lib/webhooks/resolver";
import { loadChannelVerifySecret } from "@/lib/webhooks/resolver-loader";
import { claimOnce } from "@/lib/redis/idempotency";
import { fixedWindow } from "@/lib/redis/rate-limit";
import { fireAndForgetForward } from "@/lib/webhooks/forward";

export const runtime = "nodejs";

const CHANNELS: Channel[] = ["whatsapp", "telegram", "messenger", "instagram", "widget"];
const META_CHANNELS = new Set<Channel>(["whatsapp", "messenger", "instagram"]);

function isChannel(v: string): v is Channel {
  return (CHANNELS as string[]).includes(v);
}

/** Meta GET subscription handshake (WhatsApp/Messenger/Instagram only). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channel: string; automationId: string }> },
) {
  const { channel, automationId } = await params;
  if (!isChannel(channel) || !META_CHANNELS.has(channel)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const verifyToken = await loadChannelVerifySecret(automationId, "meta_verify_token");
  if (!verifyToken) return new NextResponse("Forbidden", { status: 403 });
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const challenge = verifyMetaSubscribe(q, verifyToken);
  return challenge
    ? new NextResponse(challenge, { status: 200 })
    : new NextResponse("Forbidden", { status: 403 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channel: string; automationId: string }> },
) {
  const { channel, automationId } = await params;
  if (!isChannel(channel)) return new NextResponse("Not found", { status: 404 });

  // Read the raw body ONCE — signature verification needs the exact bytes.
  const rawBody = await req.text();

  // 1) Verify the provider signature using the per-channel vault secret.
  const ok = await verifyInbound(channel, automationId, req, rawBody);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  // 2) Resolve the automation (cached). Unknown or non-live → swallow with 200
  //    so providers don't retry forever, but do not forward.
  const automation = await resolveAutomation(automationId);
  if (!automation || !automation.engineWebhookUrl) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (automation.status === "stopped" || automation.status === "error") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 3) Rate-limit per automation+channel (fixed window).
  const rate = await fixedWindow(
    `rate:${automationId}:${channel}`,
    env.WEBHOOK_RATE_LIMIT_PER_MIN,
    60,
  );
  if (!rate.allowed) return new NextResponse("Too Many Requests", { status: 429 });

  // 4) Idempotency: skip if we've already seen this provider message id.
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    /* non-JSON bodies (rare) skip dedupe */
  }
  const msgId = body ? extractProviderMessageId(channel, body) : null;
  if (msgId) {
    const first = await claimOnce(`idem:${automationId}:${msgId}`, env.IDEMPOTENCY_TTL_SEC);
    if (!first) return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  // 5) Fire-and-forget to the engine; return 200 immediately.
  fireAndForgetForward(
    automation.engineWebhookUrl,
    req.headers.get("content-type") ?? "application/json",
    rawBody,
  );
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function verifyInbound(
  channel: Channel,
  automationId: string,
  req: NextRequest,
  rawBody: string,
): Promise<boolean> {
  if (META_CHANNELS.has(channel)) {
    const secret = await loadChannelVerifySecret(automationId, "meta_app_secret");
    if (!secret) return false;
    return verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), secret);
  }
  if (channel === "telegram") {
    const secret = await loadChannelVerifySecret(automationId, "telegram_webhook_secret");
    if (!secret) return false;
    return verifyTelegramSecret(req.headers.get("x-telegram-bot-api-secret-token"), secret);
  }
  // widget
  const secret = await loadChannelVerifySecret(automationId, "widget_signing_key");
  if (!secret) return false;
  return verifyWidgetSignature(rawBody, req.headers.get("x-cabby-signature"), secret);
}
```

- [ ] **Step 4: Write the gateway orchestration test**

`tests/webhook-gateway.test.ts` (node env; mock the lib deps so we assert the orchestration: bad signature → 401; unknown automation → 200 no-forward; rate-limited → 429; duplicate → 200 deduped no-forward; happy path → 200 + forward called once):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: { WEBHOOK_RATE_LIMIT_PER_MIN: 60, IDEMPOTENCY_TTL_SEC: 86400, CHANNEL_CACHE_TTL_SEC: 300 },
}));

const verifyMetaSignature = vi.fn();
vi.mock("@/lib/webhooks/signatures", () => ({
  verifyMetaSignature: (...a: unknown[]) => verifyMetaSignature(...a),
  verifyTelegramSecret: vi.fn(),
  verifyWidgetSignature: vi.fn(),
  verifyMetaSubscribe: vi.fn(),
}));
const resolveAutomation = vi.fn();
vi.mock("@/lib/webhooks/resolver", () => ({ resolveAutomation: (...a: unknown[]) => resolveAutomation(...a) }));
const loadChannelVerifySecret = vi.fn();
vi.mock("@/lib/webhooks/resolver-loader", () => ({
  loadChannelVerifySecret: (...a: unknown[]) => loadChannelVerifySecret(...a),
}));
const claimOnce = vi.fn();
vi.mock("@/lib/redis/idempotency", () => ({ claimOnce: (...a: unknown[]) => claimOnce(...a) }));
const fixedWindow = vi.fn();
vi.mock("@/lib/redis/rate-limit", () => ({ fixedWindow: (...a: unknown[]) => fixedWindow(...a) }));
const fireAndForgetForward = vi.fn();
vi.mock("@/lib/webhooks/forward", () => ({
  fireAndForgetForward: (...a: unknown[]) => fireAndForgetForward(...a),
}));

import { POST } from "@/app/webhooks/[channel]/[automationId]/route";

function reqWith(body: object) {
  return new Request("http://localhost/webhooks/whatsapp/a1", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=x" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}
const params = Promise.resolve({ channel: "whatsapp", automationId: "a1" });
const liveRec = { automationId: "a1", tenantId: "t1", status: "live", engineWebhookUrl: "http://engine/a1" };

beforeEach(() => {
  [verifyMetaSignature, resolveAutomation, loadChannelVerifySecret, claimOnce, fixedWindow, fireAndForgetForward].forEach((m) => m.mockReset());
  loadChannelVerifySecret.mockResolvedValue("secret");
});

describe("webhook gateway POST", () => {
  it("401 on bad signature, no forward", async () => {
    verifyMetaSignature.mockReturnValue(false);
    const res = await POST(reqWith({ entry: [] }), { params });
    expect(res.status).toBe(401);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("200 + no forward for unknown automation", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(null);
    const res = await POST(reqWith({ entry: [] }), { params });
    expect(res.status).toBe(200);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("429 when rate-limited", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(liveRec);
    fixedWindow.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(reqWith({ entry: [] }), { params });
    expect(res.status).toBe(429);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("200 deduped + no forward for a repeated message id", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(liveRec);
    fixedWindow.mockResolvedValue({ allowed: true, remaining: 59 });
    claimOnce.mockResolvedValue(false);
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.1" }] } }] }] };
    const res = await POST(reqWith(body), { params });
    expect(res.status).toBe(200);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("200 + forwards once on the happy path", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(liveRec);
    fixedWindow.mockResolvedValue({ allowed: true, remaining: 59 });
    claimOnce.mockResolvedValue(true);
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.2" }] } }] }] };
    const res = await POST(reqWith(body), { params });
    expect(res.status).toBe(200);
    expect(fireAndForgetForward).toHaveBeenCalledTimes(1);
    expect(fireAndForgetForward).toHaveBeenCalledWith("http://engine/a1", "application/json", expect.any(String));
  });
});
```

- [ ] **Step 5: Run the gateway test**

Run: `pnpm test tests/webhook-gateway.test.ts`
Expected: 5 passed. Fix the handler until green.

- [ ] **Step 6: Confirm `/webhooks` is public + full verification**

Run: `grep -n "webhooks" src/middleware/access.ts`
Expected: `/webhooks` present in `PUBLIC_PREFIXES` (it is from Epic 1 — no change needed; if absent, add it).
Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: all green; `/webhooks/[channel]/[automationId]` appears as a dynamic route in the build output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/webhooks/forward.ts src/lib/webhooks/resolver-loader.ts \
  "src/app/webhooks/[channel]/[automationId]/route.ts" tests/webhook-gateway.test.ts
git commit -m "feat(engine): inbound webhook gateway (verify→resolve→ratelimit→dedupe→forward)"
```

---

## Task 6: n8n engine client — live integration

**Files:**
- Create: `src/lib/engine/types.ts`, `src/lib/engine/client.ts`
- Test: `tests/engine-client.integration.test.ts`

n8n public REST API (v1, header `X-N8N-API-KEY`):
- `GET  /api/v1/workflows/{id}` → `{ active: boolean, ... }`
- `POST /api/v1/workflows/{id}/activate` → activates
- `POST /api/v1/workflows/{id}/deactivate` → deactivates
- `GET  /api/v1/executions?workflowId={id}&limit={n}` → `{ data: [{ id, finished, status, startedAt, stoppedAt, ... }] }`
- `GET  /api/v1/executions/{execId}` → single execution

- [ ] **Step 1: Neutral types**

`src/lib/engine/types.ts`:

```ts
/** Customer-neutral status — NO n8n vocabulary crosses this boundary. */
export type EngineStatus = "active" | "inactive";

export type EngineRun = {
  id: string;
  finished: boolean;
  status: string | null; // success | error | running | waiting (passed through, neutral)
  startedAt: string | null;
  stoppedAt: string | null;
};
```

- [ ] **Step 2: The client (injectable fetch + base/key for testability)**

`src/lib/engine/client.ts`:

```ts
import "server-only";
import { env } from "@/env";
import type { EngineRun } from "./types";

type Fetcher = typeof fetch;

export class EngineClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  /** Builds the configured client; throws a neutral error if engine env is absent. */
  static fromEnv(fetcher: Fetcher = fetch): EngineClient {
    if (!env.N8N_BASE_URL || !env.N8N_API_KEY) {
      throw new Error("Automation engine is not configured.");
    }
    return new EngineClient(env.N8N_BASE_URL.replace(/\/$/, ""), env.N8N_API_KEY, fetcher);
  }

  private async call(path: string, init?: RequestInit): Promise<Response> {
    return this.fetcher(`${this.baseUrl}/api/v1${path}`, {
      ...init,
      headers: { "X-N8N-API-KEY": this.apiKey, "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  }

  async isActive(workflowId: string): Promise<boolean> {
    const res = await this.call(`/workflows/${workflowId}`);
    if (!res.ok) throw new Error(`engine getWorkflow ${res.status}`);
    const json = (await res.json()) as { active?: boolean };
    return Boolean(json.active);
  }

  async activate(workflowId: string): Promise<void> {
    const res = await this.call(`/workflows/${workflowId}/activate`, { method: "POST" });
    if (!res.ok) throw new Error(`engine activate ${res.status}`);
  }

  async deactivate(workflowId: string): Promise<void> {
    const res = await this.call(`/workflows/${workflowId}/deactivate`, { method: "POST" });
    if (!res.ok) throw new Error(`engine deactivate ${res.status}`);
  }

  async listRuns(workflowId: string, limit = 50): Promise<EngineRun[]> {
    const res = await this.call(`/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}`);
    if (!res.ok) throw new Error(`engine listExecutions ${res.status}`);
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return (json.data ?? []).map((e) => ({
      id: String(e.id),
      finished: Boolean(e.finished),
      status: (e.status as string) ?? null,
      startedAt: (e.startedAt as string) ?? null,
      stoppedAt: (e.stoppedAt as string) ?? null,
    }));
  }
}
```

- [ ] **Step 3: Live integration test (skips without env; for this task it MUST run)**

`tests/engine-client.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { EngineClient } from "@/lib/engine/client";

const configured = Boolean(process.env.N8N_BASE_URL && process.env.N8N_API_KEY && process.env.N8N_TEST_WORKFLOW_ID);
const run = configured ? describe : describe.skip;

run("EngineClient (live n8n)", () => {
  let client: EngineClient;
  const wfId = process.env.N8N_TEST_WORKFLOW_ID as string;

  beforeAll(() => {
    client = new EngineClient(process.env.N8N_BASE_URL!.replace(/\/$/, ""), process.env.N8N_API_KEY!);
  });

  it("activate → isActive true, deactivate → isActive false", async () => {
    await client.activate(wfId);
    expect(await client.isActive(wfId)).toBe(true);
    await client.deactivate(wfId);
    expect(await client.isActive(wfId)).toBe(false);
  });

  it("listRuns returns an array", async () => {
    const runs = await client.listRuns(wfId, 5);
    expect(Array.isArray(runs)).toBe(true);
  });
});
```

Setup note for the executor: in the local n8n UI create a trivial workflow (a Manual Trigger + a NoOp), copy its id, and set `N8N_TEST_WORKFLOW_ID` in `.env.local`. Document this in the commit body.

- [ ] **Step 4: Run the integration test (n8n up + workflow id set)**

Run: `pnpm test tests/engine-client.integration.test.ts`
Expected: 2 passed (or skipped with a clear message if env unset — but for this task it MUST run green).

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm typecheck && pnpm test` → Expected: clean; all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/types.ts src/lib/engine/client.ts tests/engine-client.integration.test.ts
git commit -m "feat(engine): n8n REST client (activate/deactivate/status/runs) + live integration test"
```

---

## Task 7: Automation Control API + status sync + audit

**Files:**
- Create: `src/lib/engine/control.ts`, `src/lib/api/guard.ts`, `src/lib/audit.ts` (re-export), and the 5 route files under `src/app/api/orgs/[orgId]/automations/[automationId]/`
- Test: `tests/engine-control.test.ts`, `tests/api-guard.test.ts`

- [ ] **Step 1: Generalise the audit helper**

`src/lib/audit.ts`:

```ts
import "server-only";
// The audit ledger is shared by the admin console and the control plane.
// Re-export the canonical writer so control-plane code doesn't import from admin/.
export { writeAudit } from "@/lib/admin/audit";
```

- [ ] **Step 2: API access guard — failing test**

`tests/api-guard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const getCurrentClaims = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getCurrentClaims: () => getCurrentClaims() }));

import { evaluateOrgAccess } from "@/lib/api/guard";

beforeEach(() => getCurrentClaims.mockReset());

const claims = (over: Record<string, unknown>) => ({
  sub: "u1", tenant_id: "t1", role: "Viewer", is_flowmo_staff: false, aal: "aal2", ...over,
});

describe("evaluateOrgAccess", () => {
  it("401 when unauthenticated", () => {
    expect(evaluateOrgAccess(null, "t1", { minRole: "Viewer" }).kind).toBe("unauthorized");
  });
  it("403 when tenant mismatch and not staff", () => {
    expect(evaluateOrgAccess(claims({ tenant_id: "t2" }), "t1", { minRole: "Viewer" }).kind).toBe("forbidden");
  });
  it("allows staff across tenants", () => {
    expect(evaluateOrgAccess(claims({ is_flowmo_staff: true, tenant_id: null }), "t1", { minRole: "Owner" }).kind).toBe("allow");
  });
  it("403 when role below minRole (Viewer cannot do Owner/Admin action)", () => {
    expect(evaluateOrgAccess(claims({ role: "Viewer" }), "t1", { minRole: "Admin" }).kind).toBe("forbidden");
  });
  it("allows Owner for an Admin-min action", () => {
    expect(evaluateOrgAccess(claims({ role: "Owner" }), "t1", { minRole: "Admin" }).kind).toBe("allow");
  });
});
```

- [ ] **Step 3: Confirm failure**

Run: `pnpm test tests/api-guard.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 4: Implement the guard**

`src/lib/api/guard.ts`:

```ts
import "server-only";
import { NextResponse } from "next/server";
import { getCurrentClaims } from "@/lib/auth/session";
import type { Claims } from "@/middleware/access";

type Role = "Owner" | "Admin" | "Viewer";
const RANK: Record<Role, number> = { Viewer: 1, Admin: 2, Owner: 3 };

export type OrgAccess =
  | { kind: "allow"; claims: Claims }
  | { kind: "unauthorized" }
  | { kind: "forbidden" };

/** Pure decision: tenant match (or staff) + role >= minRole. */
export function evaluateOrgAccess(
  claims: Claims | null,
  orgId: string,
  opts: { minRole: Role },
): OrgAccess {
  if (!claims) return { kind: "unauthorized" };
  if (!claims.is_flowmo_staff && claims.tenant_id !== orgId) return { kind: "forbidden" };
  if (!claims.is_flowmo_staff) {
    const role = (claims.role ?? "Viewer") as Role;
    if (RANK[role] < RANK[opts.minRole]) return { kind: "forbidden" };
  }
  return { kind: "allow", claims };
}

/** Route helper: returns claims or a NextResponse to short-circuit. */
export async function requireOrgAccess(
  orgId: string,
  opts: { minRole: Role },
): Promise<{ claims: Claims } | NextResponse> {
  const claims = await getCurrentClaims();
  const decision = evaluateOrgAccess(claims, orgId, opts);
  if (decision.kind === "allow") return { claims: decision.claims };
  if (decision.kind === "unauthorized") return new NextResponse("Unauthorized", { status: 401 });
  return new NextResponse("Forbidden", { status: 403 });
}
```

- [ ] **Step 5: Confirm pass**

Run: `pnpm test tests/api-guard.test.ts` → Expected: PASS.

- [ ] **Step 6: Control layer — failing test**

`tests/engine-control.test.ts` (mocks EngineClient + Supabase + audit; asserts start activates + sets status 'live' + audits, stop deactivates + sets 'stopped' + audits, status maps active→live/inactive→stopped):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const activate = vi.fn(), deactivate = vi.fn(), isActive = vi.fn(), listRuns = vi.fn();
vi.mock("@/lib/engine/client", () => ({
  EngineClient: { fromEnv: () => ({ activate, deactivate, isActive, listRuns }) },
}));
const writeAudit = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAudit(...a) }));
const updateStatus = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/engine/control-db", () => ({
  setAutomationStatus: (...a: unknown[]) => updateStatus(...a),
  getEngineWorkflowId: vi.fn().mockResolvedValue("wf1"),
}));

import { startAutomation, stopAutomation, getStatus } from "@/lib/engine/control";

beforeEach(() => [activate, deactivate, isActive, listRuns, writeAudit, updateStatus].forEach((m) => m.mockClear()));

describe("control layer", () => {
  it("startAutomation activates, sets live, audits", async () => {
    await startAutomation({ automationId: "a1", tenantId: "t1", actorUserId: "u1" });
    expect(activate).toHaveBeenCalledWith("wf1");
    expect(updateStatus).toHaveBeenCalledWith("a1", "live");
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "automation.start", targetId: "a1" }));
  });
  it("stopAutomation deactivates, sets stopped, audits", async () => {
    await stopAutomation({ automationId: "a1", tenantId: "t1", actorUserId: "u1" });
    expect(deactivate).toHaveBeenCalledWith("wf1");
    expect(updateStatus).toHaveBeenCalledWith("a1", "stopped");
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "automation.stop" }));
  });
  it("getStatus maps engine active→live", async () => {
    isActive.mockResolvedValue(true);
    expect(await getStatus({ automationId: "a1" })).toMatchObject({ status: "live" });
  });
});
```

- [ ] **Step 7: Confirm failure**

Run: `pnpm test tests/engine-control.test.ts` → Expected: FAIL (modules not found).

- [ ] **Step 8: Implement the control DB helper + control layer**

`src/lib/engine/control-db.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Internal engine workflow id for an automation (never surfaced to tenants). */
export async function getEngineWorkflowId(automationId: string): Promise<string | null> {
  const { data } = await svc()
    .from("automations")
    .select("engine_workflow_id")
    .eq("id", automationId)
    .maybeSingle();
  return (data?.engine_workflow_id as string) ?? null;
}

export async function setAutomationStatus(automationId: string, status: string): Promise<void> {
  await svc().from("automations").update({ status, updated_at: new Date().toISOString() }).eq("id", automationId);
}
```

`src/lib/engine/control.ts`:

```ts
import "server-only";
import { EngineClient } from "./client";
import { writeAudit } from "@/lib/audit";
import { getEngineWorkflowId, setAutomationStatus } from "./control-db";
import type { EngineRun } from "./types";

type Ctx = { automationId: string; tenantId: string; actorUserId: string };

async function workflowOrThrow(automationId: string): Promise<string> {
  const wf = await getEngineWorkflowId(automationId);
  if (!wf) throw new Error("Automation is not yet provisioned in the engine.");
  return wf;
}

export async function startAutomation(ctx: Ctx): Promise<void> {
  const wf = await workflowOrThrow(ctx.automationId);
  await EngineClient.fromEnv().activate(wf);
  await setAutomationStatus(ctx.automationId, "live");
  await writeAudit({
    actorUserId: ctx.actorUserId, tenantId: ctx.tenantId,
    action: "automation.start", targetType: "automation", targetId: ctx.automationId,
  });
}

export async function stopAutomation(ctx: Ctx): Promise<void> {
  const wf = await workflowOrThrow(ctx.automationId);
  await EngineClient.fromEnv().deactivate(wf);
  await setAutomationStatus(ctx.automationId, "stopped");
  await writeAudit({
    actorUserId: ctx.actorUserId, tenantId: ctx.tenantId,
    action: "automation.stop", targetType: "automation", targetId: ctx.automationId,
  });
}

export async function restartAutomation(ctx: Ctx): Promise<void> {
  const wf = await workflowOrThrow(ctx.automationId);
  const client = EngineClient.fromEnv();
  await client.deactivate(wf);
  await client.activate(wf);
  await setAutomationStatus(ctx.automationId, "live");
  await writeAudit({
    actorUserId: ctx.actorUserId, tenantId: ctx.tenantId,
    action: "automation.restart", targetType: "automation", targetId: ctx.automationId,
  });
}

export async function getStatus(ctx: { automationId: string }): Promise<{ status: "live" | "stopped" }> {
  const wf = await workflowOrThrow(ctx.automationId);
  const active = await EngineClient.fromEnv().isActive(wf);
  return { status: active ? "live" : "stopped" };
}

export async function listRuns(ctx: { automationId: string }, limit = 50): Promise<EngineRun[]> {
  const wf = await workflowOrThrow(ctx.automationId);
  return EngineClient.fromEnv().listRuns(wf, limit);
}
```

- [ ] **Step 9: Confirm pass**

Run: `pnpm test tests/engine-control.test.ts` → Expected: PASS.

- [ ] **Step 10: The 5 route handlers**

`src/app/api/orgs/[orgId]/automations/[automationId]/start/route.ts`:

```ts
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { startAutomation } from "@/lib/engine/control";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; automationId: string }> },
) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  try {
    await startAutomation({ automationId, tenantId: orgId, actorUserId: gate.claims.sub });
    return NextResponse.json({ ok: true, status: "live" });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not start the automation." }, { status: 502 });
  }
}
```

`.../stop/route.ts` — identical shape calling `stopAutomation`, returns `status: "stopped"`, `minRole: "Admin"`.

`.../restart/route.ts` — calls `restartAutomation`, returns `status: "live"`, `minRole: "Admin"`.

`.../status/route.ts`:

```ts
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getStatus } from "@/lib/engine/control";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; automationId: string }> },
) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json(await getStatus({ automationId }));
  } catch {
    return NextResponse.json({ error: "Status unavailable." }, { status: 502 });
  }
}
```

`.../runs/route.ts` — `GET`, `minRole: "Viewer"`, reads `?limit=` (default 50, clamp 1–100), returns `{ runs: await listRuns({ automationId }, limit) }`.

Write out `stop`, `restart`, and `runs` in full following these shapes (do not abbreviate in the actual files).

- [ ] **Step 11: Verify build + full suite**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: all green; the 5 API routes + the webhook route appear in the build output as dynamic routes.

- [ ] **Step 12: Commit**

```bash
git add src/lib/audit.ts src/lib/api/guard.ts src/lib/engine/control.ts src/lib/engine/control-db.ts \
  "src/app/api/orgs/[orgId]/automations/[automationId]" \
  tests/api-guard.test.ts tests/engine-control.test.ts
git commit -m "feat(engine): automation control API (start/stop/restart/status/runs) + status sync + audit"
```

---

## Task 8: CI wiring, brand-rule guard, final pass

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `tests/engine-brand.test.ts`

- [ ] **Step 1: Start the engine stack in CI**

In `.github/workflows/ci.yml`, before the test step (and after `supabase start`), add a step to bring up the engine stack and export its env for the test job:

```yaml
      - name: Start automation engine stack
        run: docker compose -f docker-compose.engine.yml up -d
      - name: Wait for SRH + n8n
        run: |
          for i in $(seq 1 30); do
            curl -sf http://localhost:8079/get/ci-ping -H "Authorization: Bearer local-dev-srh-token" && break || sleep 2
          done
          for i in $(seq 1 30); do curl -sf http://localhost:5678/healthz && break || sleep 2; done
      - name: Engine env for tests
        run: |
          echo "UPSTASH_REDIS_REST_URL=http://localhost:8079" >> "$GITHUB_ENV"
          echo "UPSTASH_REDIS_REST_TOKEN=local-dev-srh-token" >> "$GITHUB_ENV"
```

(n8n API-key-dependent integration tests stay `describe.skip` in CI unless `N8N_API_KEY`/`N8N_TEST_WORKFLOW_ID` secrets are provided — the redis-integration test runs against SRH. Document that the engine-client integration test is exercised locally by the executor and is optional in CI.)

- [ ] **Step 2: Brand-rule guard for customer-facing engine surfaces**

`tests/engine-brand.test.ts`: recursively scan the API route files under `src/app/api/orgs/**` and the webhook route, asserting none of their RESPONSE bodies/literals contain `n8n`, `workflow`, or `execution` (the forbidden customer-facing vocabulary). Mirror the structure of `tests/marketing-brand.test.ts`. (The `src/lib/engine/**` internals legitimately use n8n terms — scan only the route handlers, which are the customer-facing surface.)

```ts
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SURFACES = [join(ROOT, "src/app/api/orgs"), join(ROOT, "src/app/webhooks")];
const FORBIDDEN = ["n8n", "workflow", "execution"];

function files(dir: string): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return []; }
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e);
    const st = lstatSync(full);
    if (st.isDirectory()) out.push(...files(full));
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

describe("engine API brand rule", () => {
  it("customer-facing route handlers contain no engine vocabulary", () => {
    const offenders: Array<{ file: string; terms: string[] }> = [];
    for (const f of SURFACES.flatMap(files)) {
      const content = readFileSync(f, "utf8").toLowerCase();
      const hit = FORBIDDEN.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(content));
      if (hit.length) offenders.push({ file: f, terms: hit });
    }
    expect(offenders).toEqual([]);
  });
});
```

(Note: the webhook route imports modules with engine terms but the route FILE itself uses neutral names — `resolveAutomation`, `fireAndForgetForward`, `engineWebhookUrl`. The literal token "n8n"/"workflow"/"execution" must not appear in these files. If the build-output route comment or a variable forces a term, rename it. Confirm the test passes.)

- [ ] **Step 3: Run the brand guard + adjust if needed**

Run: `pnpm test tests/engine-brand.test.ts`
Expected: PASS. If it fails, rename the offending identifier in the route file (keep engine vocabulary inside `src/lib/engine/**`).

- [ ] **Step 4: Full verification**

```bash
docker compose -f docker-compose.engine.yml up -d
supabase db reset
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```
Expected: all green. Note any integration test that skipped due to missing `N8N_API_KEY`/`N8N_TEST_WORKFLOW_ID`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/engine-brand.test.ts
git commit -m "feat(engine): CI engine stack + customer-facing brand-rule guard"
```

---

## Definition of Done (Epic 5)

- [ ] Inbound gateway at `/webhooks/:channel/:automationId` for all 5 channels: GET Meta subscription handshake; POST verifies the per-channel signature (Meta HMAC / Telegram secret token / widget HMAC) using vault secrets, resolves the automation (Redis-cached 5-min), rate-limits per automation+channel, dedupes on the provider message id (Redis, 24h), fire-and-forgets to the engine webhook URL, and returns 200 — invalid signature → 401, unknown/stopped automation → 200 no-forward, over-limit → 429, duplicate → 200 no-forward.
- [ ] n8n engine client (activate/deactivate/isActive/listRuns) with injectable transport; live integration test green against local n8n.
- [ ] Redis cache / idempotency / rate-limit primitives; live integration test green against SRH.
- [ ] Automation Control API (`/api/orgs/:orgId/automations/:automationId/{start,stop,restart,status,runs}`): tenant-or-staff + role gate (Admin+ for start/stop/restart, Viewer+ for status/runs), calls the engine client, mirrors result into `automations.status`, audit-logs every control action via `writeAudit`.
- [ ] Brand rule holds: no `n8n`/`workflow`/`execution` in any customer-facing route handler (engine internals contained in `src/lib/engine/**`); brand-rule test green.
- [ ] Migrations 0012 (`engine_webhook_url`) + 0013 (verify-secret credential types) apply cleanly on `supabase db reset`.
- [ ] `pnpm build`/`typecheck`/`lint` pass; `pnpm test` green (unit always; live integration green with the docker stack up); CI starts the engine stack.

**Hand-off:** the gateway + engine client + Control API are the runtime substrate Epic 6 (dispatch adapters — the engine calls them) and Epic 7 (dashboard start/stop buttons + live runs view call this Control API) build on. `engine_webhook_url` and the verify-secret vault types are populated per-automation during admin provisioning/build (Epic 3 console can be extended to set them when the engineer wires the workflow). Voice pipeline (Epic 10) rides the same gateway for WhatsApp audio.
