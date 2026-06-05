import { z } from "zod";

// Client-safe environment. ONLY `NEXT_PUBLIC_*` vars belong here: these are the
// values Next.js statically inlines into the browser bundle. Server secrets
// (SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, …) live in `@/env`, which is
// marked `server-only` and must never be imported from client code.
//
// Each var is referenced as a literal `process.env.X` so the inlining works;
// dynamic access (`process.env[key]`) is NOT inlined and would be undefined in
// the browser.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_CAL_LINK: z.string().min(1).default("flowmo/discovery"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://bookmycab.com"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_DEMO_WA_NUMBER: z.string().optional(),
});

// Required vars keep an empty string so a blanked-out key fails loudly; blank
// optionals are treated as absent so they fall back to their defaults.
const REQUIRED_KEYS = new Set<string>([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]);

const rawSource: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CAL_LINK: process.env.NEXT_PUBLIC_CAL_LINK,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_DEMO_WA_NUMBER: process.env.NEXT_PUBLIC_DEMO_WA_NUMBER,
};

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
  console.error("❌ Invalid public environment variables:", fieldErrors);
  throw new Error(
    `Invalid public environment variables: ${JSON.stringify(fieldErrors)}`,
  );
}

export const clientEnv = parsed.data;
