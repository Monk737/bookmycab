import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { WEBHOOK_RATE_LIMIT_PER_MIN: 60, IDEMPOTENCY_TTL_SEC: 86400, CHANNEL_CACHE_TTL_SEC: 300 } }));
vi.mock("@/lib/webhooks/signatures", () => ({
  verifyMetaSignature: vi.fn(() => true), verifyTelegramSecret: vi.fn(), verifyWidgetSignature: vi.fn(), verifyMetaSubscribe: vi.fn(),
}));
const resolveAutomation = vi.fn();
vi.mock("@/lib/webhooks/resolver", () => ({ resolveAutomation: (...a: unknown[]) => resolveAutomation(...a) }));
vi.mock("@/lib/webhooks/resolver-loader", () => ({ loadChannelVerifySecret: vi.fn().mockResolvedValue("secret") }));
const claimOnce = vi.fn();
vi.mock("@/lib/redis/idempotency", () => ({ claimOnce: (...a: unknown[]) => claimOnce(...a) }));
const fixedWindow = vi.fn();
vi.mock("@/lib/redis/rate-limit", () => ({ fixedWindow: (...a: unknown[]) => fixedWindow(...a) }));
vi.mock("@/lib/webhooks/forward", () => ({ fireAndForgetForward: vi.fn() }));

import { POST } from "@/app/webhooks/[channel]/[automationId]/route";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";

const ID = "11111111-1111-1111-1111-111111111111";
const params = Promise.resolve({ channel: "whatsapp", automationId: ID });
function req() {
  return new Request(`http://x/webhooks/whatsapp/${ID}`, {
    method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=x" },
    body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
  }) as unknown as import("next/server").NextRequest;
}

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); [resolveAutomation, claimOnce, fixedWindow].forEach((m) => m.mockReset()); });
afterEach(() => resetSink());

describe("webhook gateway metrics", () => {
  it("records ACK latency + a forwarded counter on the happy path", async () => {
    resolveAutomation.mockResolvedValue({ automationId: ID, status: "live", engineWebhookUrl: "http://engine/a" });
    fixedWindow.mockResolvedValue({ allowed: true });
    claimOnce.mockResolvedValue(true);
    await POST(req(), { params });
    expect(mem.metrics.find((m) => m.name === "webhook_ack_ms")).toMatchObject({ kind: "histogram", attributes: { channel: "whatsapp" } });
    expect(mem.metrics.find((m) => m.name === "webhook_inbound_total")).toMatchObject({ attributes: { channel: "whatsapp", status: "forwarded" } });
  });

  it("tags the counter rate_limited when throttled", async () => {
    resolveAutomation.mockResolvedValue({ automationId: ID, status: "live", engineWebhookUrl: "http://engine/a" });
    fixedWindow.mockResolvedValue({ allowed: false });
    await POST(req(), { params });
    expect(mem.metrics.find((m) => m.name === "webhook_inbound_total")).toMatchObject({ attributes: { status: "rate_limited" } });
  });
});
