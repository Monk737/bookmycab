import { describe, it, expect } from "vitest";
import { activationInvoiceEmail } from "@/lib/email/templates";

describe("activationInvoiceEmail", () => {
  const body = activationInvoiceEmail({
    tenantName: "Speedy Cabs",
    planLabel: "AI Voice — Ignition",
    amountMajor: 2998,
    currency: "GBP",
    invoiceUrl: "https://invoice.stripe.com/i/test_123",
  });
  it("has a pay CTA to the hosted invoice", () => {
    expect(body.html).toContain("https://invoice.stripe.com/i/test_123");
    expect(body.text).toContain("https://invoice.stripe.com/i/test_123");
  });
  it("shows the amount and plan", () => {
    expect(body.subject).toContain("Speedy Cabs");
    expect(body.html).toContain("£2,998");
    expect(body.html).toContain("AI Voice — Ignition");
  });
  it("never leaks internal engine vocabulary", () => {
    expect(body.html.toLowerCase()).not.toContain("n8n");
  });
});
