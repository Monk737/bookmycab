import { describe, it, expect } from "vitest";
import {
  tenantWelcomeEmail,
  automationCreatedEmail,
  paymentReceivedEmail,
} from "@/lib/email/templates";

// Customer-facing copy must never leak internal vocabulary.
const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
function assertClean(b: { subject: string; html: string; text: string }) {
  for (const s of [b.subject, b.html, b.text]) expect(s).not.toMatch(banned);
}

describe("tenantWelcomeEmail", () => {
  const out = tenantWelcomeEmail({
    tenantName: "Speedy Cabs",
    role: "Owner",
    loginUrl: "https://bookmycab.io/login",
    invitePending: true,
  });
  it("names the org and role, includes the login link", () => {
    expect(out.subject).toMatch(/Speedy Cabs/);
    expect(out.html).toMatch(/Owner/);
    expect(out.html).toMatch(/https:\/\/bookmycab\.io\/login/);
    expect(out.text).toMatch(/https:\/\/bookmycab\.io\/login/);
  });
  it("mentions the separate password email when invite pending", () => {
    expect(out.text).toMatch(/set your password/i);
  });
  it("stays on-brand", () => assertClean(out));
});

describe("automationCreatedEmail", () => {
  it("live voice agent reads as live and avoids internal terms", () => {
    const out = automationCreatedEmail({
      tenantName: "Speedy Cabs",
      automationName: "Daytime Line",
      automationType: "Voice",
      live: true,
      dashboardUrl: "https://bookmycab.io/dashboard",
    });
    expect(out.subject).toMatch(/live/i);
    expect(out.html).toMatch(/AI Voice agent/);
    expect(out.html).toMatch(/Daytime Line/);
    assertClean(out);
  });
  it("building automation reads as in-progress", () => {
    const out = automationCreatedEmail({
      tenantName: "Speedy Cabs",
      automationName: "Booking Bot",
      automationType: "Booking",
      live: false,
      dashboardUrl: "https://bookmycab.io/dashboard",
    });
    expect(out.subject).toMatch(/building/i);
    assertClean(out);
  });
});

describe("paymentReceivedEmail", () => {
  const out = paymentReceivedEmail({
    tenantName: "Speedy Cabs",
    amountMajor: 999,
    currency: "GBP",
    periodLabel: "01/06/2026 – 30/06/2026",
    invoiceUrl: "https://invoice.stripe.com/i/xyz",
  });
  it("shows the amount, period, and invoice link", () => {
    expect(out.subject).toMatch(/£999/);
    expect(out.html).toMatch(/£999/);
    expect(out.html).toMatch(/01\/06\/2026/);
    expect(out.html).toMatch(/https:\/\/invoice\.stripe\.com\/i\/xyz/);
  });
  it("stays on-brand", () => assertClean(out));
});

describe("html escaping", () => {
  it("escapes angle brackets in interpolated values", () => {
    const out = automationCreatedEmail({
      tenantName: "A & B <script>",
      automationName: "Bot <b>",
      automationType: "Booking",
      live: false,
      dashboardUrl: "https://bookmycab.io/dashboard",
    });
    expect(out.html).not.toMatch(/<script>/);
    expect(out.html).toMatch(/&lt;script&gt;/);
  });
});
