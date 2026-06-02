import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const p = (rel: string) => join(process.cwd(), rel);

describe("epic-8 billing files exist", () => {
  // TODO(epic-8): uncomment as later tasks land
  for (const f of [
    "src/lib/billing/stripe.ts",
    "src/lib/billing/plan-price.ts",
    // "src/lib/billing/dates.ts",
    // "src/lib/billing/event-map.ts",
    // "src/lib/billing/handle-event.ts",
    "src/lib/email/resend.ts",
    "src/lib/email/templates.ts",
    // "src/app/webhooks/stripe/route.ts",
    // "src/app/admin/tenants/[tenantId]/billing-actions.ts",
  ]) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});
