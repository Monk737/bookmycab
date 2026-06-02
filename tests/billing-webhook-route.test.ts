import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { constructEvent, claimOnce, handleStripeEvent } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  claimOnce: vi.fn(async (_key: string, _ttl: number) => true),
  handleStripeEvent: vi.fn(async () => ({ action: "ignored" as const })),
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

vi.mock("@/lib/redis/idempotency", () => ({ claimOnce: (k: string, t: number) => claimOnce(k, t) }));

vi.mock("@/lib/billing/handle-event", () => ({ handleStripeEvent }));
vi.mock("@/lib/billing/webhook-deps", () => ({ buildBillingDeps: () => ({}) }));

vi.mock("@/env", () => ({ env: { STRIPE_WEBHOOK_SECRET: "whsec_test" } }));

import { POST } from "@/app/webhooks/stripe/route";

function req(body: string, sig: string | null): Request {
  const headers = new Headers();
  if (sig !== null) headers.set("stripe-signature", sig);
  return new Request("https://x/webhooks/stripe", { method: "POST", body, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  claimOnce.mockResolvedValue(true);
  handleStripeEvent.mockResolvedValue({ action: "ignored" });
});

describe("POST /webhooks/stripe", () => {
  it("400s when the signature header is missing", async () => {
    const res = await POST(req("{}", null));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("400s when constructEvent throws (bad signature)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req("{}", "t=1,v1=deadbeef"));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("dispatches a verified event and 200s", async () => {
    constructEvent.mockReturnValue({ id: "evt_9", type: "invoice.paid", data: { object: {} } });
    const res = await POST(req("{}", "t=1,v1=good"));
    expect(res.status).toBe(200);
    expect(handleStripeEvent).toHaveBeenCalledOnce();
  });

  it("skips a duplicate event id (idempotency) and still 200s", async () => {
    constructEvent.mockReturnValue({ id: "evt_9", type: "invoice.paid", data: { object: {} } });
    claimOnce.mockResolvedValue(false);
    const res = await POST(req("{}", "t=1,v1=good"));
    expect(res.status).toBe(200);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });
});
