import { describe, it, expect } from "vitest";
import { paymentFailedEmail } from "@/lib/email/templates";

describe("paymentFailedEmail", () => {
  const out = paymentFailedEmail({
    tenantName: "Speedy Cabs",
    amountMajor: 500,
    currency: "GBP",
    invoiceUrl: "https://invoice.stripe.com/i/abc",
  });

  it("has a clear subject naming the tenant", () => {
    expect(out.subject).toMatch(/Speedy Cabs/);
    expect(out.subject).toMatch(/payment/i);
  });
  it("includes the formatted amount and a pay link", () => {
    expect(out.html).toMatch(/£500/);
    expect(out.html).toMatch(/https:\/\/invoice\.stripe\.com\/i\/abc/);
    expect(out.text).toMatch(/£500/);
  });
  it("never leaks internal vocabulary (brand rule)", () => {
    const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
    expect(out.subject).not.toMatch(banned);
    expect(out.html).not.toMatch(banned);
    expect(out.text).not.toMatch(banned);
  });
});
