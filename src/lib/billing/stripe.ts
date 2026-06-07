import "server-only";
import Stripe from "stripe";
import { env } from "@/env";

/**
 * Lazy Stripe SDK singleton.
 *
 * `STRIPE_SECRET_KEY` is optional in `env.ts` (so the app boots in envs without
 * billing configured). Any code path that actually needs Stripe calls
 * `getStripe()`, which throws a clear error when the key is absent rather than
 * letting the SDK fail obscurely. The instance is cached across calls.
 *
 * We deliberately do NOT pin `apiVersion`, the account default is used, which
 * keeps us off a hard-coded version string that the installed SDK types might
 * not match.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  }
  cached = new Stripe(key);
  return cached;
}

/** Test seam: clear the cached instance. */
export function __resetStripeForTests(): void {
  cached = null;
}
