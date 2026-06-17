import { describe, it, expect } from "vitest";
import { mapStripeInvoiceRow } from "@/lib/dashboard/open-invoices";

describe("mapStripeInvoiceRow", () => {
  it("maps id, amount (minor→major), hosted url, due date", () => {
    const row = mapStripeInvoiceRow({
      id: "in_1",
      amount_due: 49900,
      currency: "gbp",
      hosted_invoice_url: "https://invoice.stripe.com/i/x",
      due_date: 1_752_000_000,
      status: "open",
    } as never);
    expect(row).toEqual({
      id: "in_1",
      amountGbp: 499,
      hostedUrl: "https://invoice.stripe.com/i/x",
      dueDate: "2025-07-08",
    });
  });
  it("tolerates a missing due date + url", () => {
    const row = mapStripeInvoiceRow({ id: "in_2", amount_due: 0, currency: "gbp", hosted_invoice_url: null, due_date: null, status: "open" } as never);
    expect(row.dueDate).toBeNull();
    expect(row.hostedUrl).toBeNull();
    expect(row.amountGbp).toBe(0);
  });
});
