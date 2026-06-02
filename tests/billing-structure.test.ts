import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const p = (rel: string) => join(process.cwd(), rel);

describe("epic-8 billing files exist", () => {
  for (const f of [
    "src/lib/billing/stripe.ts",
    "src/lib/billing/plan-price.ts",
    "src/lib/billing/dates.ts",
    "src/lib/billing/event-map.ts",
    "src/lib/billing/handle-event.ts",
    "src/lib/email/resend.ts",
    "src/lib/email/templates.ts",
    "src/app/webhooks/stripe/route.ts",
    "src/app/admin/tenants/[tenantId]/billing-actions.ts",
  ]) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});

describe("epic-8 admin billing wiring", () => {
  it("tenant detail renders the BillingPanel", () => {
    const src = readFileSync(p("src/app/admin/tenants/[tenantId]/page.tsx"), "utf8");
    expect(src).toMatch(/BillingPanel/);
  });

  it("admin billing page no longer carries the epic-8 stub TODO", () => {
    const src = readFileSync(p("src/app/admin/billing/page.tsx"), "utf8");
    expect(src).not.toMatch(/TODO\(epic-8\)/);
  });

  it("service-role billing usage stays confined to admin actions + webhook deps", () => {
    // Customer-facing billing must never touch the service-role key.
    const forbidden = [
      "src/lib/dashboard/billing-queries.ts",
      "src/app/dashboard/billing/page.tsx",
      "src/app/api/orgs/[orgId]/billing/portal/route.ts",
    ];
    for (const f of forbidden) {
      expect(readFileSync(p(f), "utf8"), f).not.toMatch(/SERVICE_ROLE/);
    }
    // The allowlisted server-side billing files DO use it.
    for (const f of [
      "src/app/admin/tenants/[tenantId]/billing-actions.ts",
      "src/lib/billing/webhook-deps.ts",
    ]) {
      expect(readFileSync(p(f), "utf8"), f).toMatch(/SERVICE_ROLE/);
    }
  });
});

describe("epic-8 portal + brand", () => {
  it("portal route creates a real Stripe billing portal session", () => {
    const src = readFileSync(p("src/app/api/orgs/[orgId]/billing/portal/route.ts"), "utf8");
    expect(src).toMatch(/billingPortal\.sessions\.create/);
    expect(src).not.toMatch(/Billing portal is being set up/); // old stub copy gone
  });

  it("no banned internal vocabulary on customer-facing billing surfaces", () => {
    const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
    for (const f of [
      "src/app/dashboard/billing/page.tsx",
      "src/app/dashboard/billing/portal-button.tsx",
      "src/lib/email/templates.ts",
      "src/app/api/orgs/[orgId]/billing/portal/route.ts",
    ]) {
      expect(readFileSync(p(f), "utf8"), f).not.toMatch(banned);
    }
  });
});
