import { getSink, type Attrs } from "./sink";

// Customer PII / secrets must never reach a log drain or Sentry. Keys matching
// this pattern are masked; everything else is coerced to a primitive.
const PII_KEY = /phone|email|name|handle|address|token|secret|\bkey\b|authorization|passenger/i;

export function redactAttrs(attrs: Record<string, unknown>): Attrs {
  const out: Attrs = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (PII_KEY.test(k)) { out[k] = "[redacted]"; continue; }
    out[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : String(v);
  }
  return out;
}

/** Reports an error to the active sink with PII-redacted context attributes. */
export function reportError(err: unknown, attrs: Record<string, unknown> = {}): void {
  const e = err instanceof Error ? err : new Error(String(err));
  getSink().error({ name: e.name, message: e.message, attributes: redactAttrs(attrs) });
}
