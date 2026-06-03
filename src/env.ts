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

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("hello@cabbybot.com"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Gateway / demo / internal
  WEBHOOK_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),

  // Gateway tuning (defaults match PRD §7 + Epic 5).
  CHANNEL_CACHE_TTL_SEC: z.coerce.number().int().positive().default(300),
  IDEMPOTENCY_TTL_SEC: z.coerce.number().int().positive().default(86400),
  DEMO_TENANT_ID: z.string().uuid().optional(),
  DEMO_SESSION_SECRET: z.string().min(8).default("cabbybot-demo-2026"),
  FLOWMO_STAFF_EMAIL_DOMAIN: z.string().default("flowmoai.com"),

  // Marketing
  NEXT_PUBLIC_CAL_LINK: z.string().min(1).default("flowmo/discovery"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://cabbybot.com"),

  // Observability (Epic 11). Activation is deploy-time; absent → telemetry no-ops.
  OBSERVABILITY_STDOUT: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("cabbybot"),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

// Vars with no `.optional()`/`.default()` — a blank value here is a real
// misconfiguration and must surface as a validation error, not be hidden.
const REQUIRED_KEYS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

// Treat empty-string values for optional/defaulted vars as absent (a common
// `.env` artifact, e.g. `N8N_BASE_URL=`) so they don't fail `.url()`/`.uuid()`.
// Required vars keep their empty string so a blanked-out key still fails loudly.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) => value !== "" || REQUIRED_KEYS.has(key),
  ),
);

const parsed = schema.safeParse(rawEnv);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
