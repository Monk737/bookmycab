// Server-only: this module validates server secrets (SUPABASE_SERVICE_ROLE_KEY,
// STRIPE_SECRET_KEY, …) that must never reach the browser. Client code needs
// `clientEnv` from `@/env.client` instead. Importing this from a Client
// Component triggers a build-time error rather than a runtime crash.
import "server-only";
import { z } from "zod";

const schema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Channel-credentials vault symmetric key (server-only). Passed per-call to the
  // vault_*_rpc functions, which set it transaction-locally before delegating to
  // the pgcrypto-backed vault. NEVER logged, NEVER returned to the client. In
  // production this comes from the platform secret manager; the local-dev default
  // below keeps `supabase start` + tests working without extra setup.
  SUPABASE_VAULT_KEY: z.string().min(1).default("local-dev-vault-key-change-me"),

  // Engine (internal only; never exposed to customers)
  N8N_BASE_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Voice call metering — bearer secret for the call-ingest endpoint
  // (B5). Server-only; the voice provider posts call records with this token.
  VOICE_INGEST_SECRET: z.string().min(1),

  // WhatsApp Chatbot (Chat + Voice Note) mirror — bearer secret for the chat
  // ingest endpoints (/api/chat/*). Server-only; the tenant's n8n chat workflow
  // posts conversation + booking events with this token. Optional/default ""
  // so environments that haven't wired chat yet don't fail validation — an
  // empty secret makes the endpoint reject every request (never accept blindly).
  CHAT_INGEST_SECRET: z.string().default(""),

  // Gemini — server-only key for the weekly AI briefing (Tier 3). Optional:
  // absent → the briefing generator no-ops and the panel shows its empty state.
  GEMINI_API_KEY: z.string().optional(),
  BRIEFING_MODEL: z.string().default("gemini-2.5-flash"),

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("hello@bookmycab.com"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Gateway / demo / internal
  WEBHOOK_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),

  // Gateway tuning (defaults match PRD §7 + Epic 5).
  CHANNEL_CACHE_TTL_SEC: z.coerce.number().int().positive().default(300),
  IDEMPOTENCY_TTL_SEC: z.coerce.number().int().positive().default(86400),
  DEMO_TENANT_ID: z.string().uuid().optional(),
  DEMO_SESSION_SECRET: z.string().min(8).default("bookmycab-demo-2026"),
  FLOWMO_STAFF_EMAIL_DOMAIN: z.string().default("flowmoai.com"),

  // Marketing
  NEXT_PUBLIC_CAL_LINK: z.string().min(1).default("flowmo/discovery"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://bookmycab.com"),

  // Observability (Epic 11). Activation is deploy-time; absent → telemetry no-ops.
  OBSERVABILITY_STDOUT: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("bookmycab"),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_DEMO_WA_NUMBER: z.string().optional(),
});

// Vars with no `.optional()`/`.default()`, a blank value here is a real
// misconfiguration and must surface as a validation error, not be hidden.
const REQUIRED_KEYS = new Set<string>([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VOICE_INGEST_SECRET",
]);

// Reference each var as a literal `process.env.X` so Next.js can statically
// inline the `NEXT_PUBLIC_*` values into the client bundle. `Object.entries(
// process.env)` does NOT work here: in the browser `process.env` is not a real
// object, so enumerating it drops every key and validation would throw on the
// client. This module is imported by client code (e.g. supabase/browser.ts).
const rawSource: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_VAULT_KEY: process.env.SUPABASE_VAULT_KEY,
  VOICE_INGEST_SECRET: process.env.VOICE_INGEST_SECRET,
  CHAT_INGEST_SECRET: process.env.CHAT_INGEST_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  BRIEFING_MODEL: process.env.BRIEFING_MODEL,
  N8N_BASE_URL: process.env.N8N_BASE_URL,
  N8N_API_KEY: process.env.N8N_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  WEBHOOK_RATE_LIMIT_PER_MIN: process.env.WEBHOOK_RATE_LIMIT_PER_MIN,
  CHANNEL_CACHE_TTL_SEC: process.env.CHANNEL_CACHE_TTL_SEC,
  IDEMPOTENCY_TTL_SEC: process.env.IDEMPOTENCY_TTL_SEC,
  DEMO_TENANT_ID: process.env.DEMO_TENANT_ID,
  DEMO_SESSION_SECRET: process.env.DEMO_SESSION_SECRET,
  FLOWMO_STAFF_EMAIL_DOMAIN: process.env.FLOWMO_STAFF_EMAIL_DOMAIN,
  NEXT_PUBLIC_CAL_LINK: process.env.NEXT_PUBLIC_CAL_LINK,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  OBSERVABILITY_STDOUT: process.env.OBSERVABILITY_STDOUT,
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_DEMO_WA_NUMBER: process.env.NEXT_PUBLIC_DEMO_WA_NUMBER,
};

// Treat empty-string values for optional/defaulted vars as absent (a common
// `.env` artifact, e.g. `N8N_BASE_URL=`) so they don't fail `.url()`/`.uuid()`.
// Required vars keep their empty string so a blanked-out key still fails loudly.
const rawEnv: Record<string, string> = Object.fromEntries(
  Object.entries(rawSource).filter(
    (entry): entry is [string, string] => {
      const [key, value] = entry;
      return value !== undefined && (value !== "" || REQUIRED_KEYS.has(key));
    },
  ),
);

const parsed = schema.safeParse(rawEnv);
if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error("❌ Invalid environment variables:", fieldErrors);
  // Embed the offending fields in the thrown message so the failure is
  // actionable even where console output is dropped (serverless, browser).
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(fieldErrors)}`,
  );
}

export const env = parsed.data;
