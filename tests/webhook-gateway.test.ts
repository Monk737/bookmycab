import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: { WEBHOOK_RATE_LIMIT_PER_MIN: 60, IDEMPOTENCY_TTL_SEC: 86400, CHANNEL_CACHE_TTL_SEC: 300 },
}));

const verifyMetaSignature = vi.fn();
vi.mock("@/lib/webhooks/signatures", () => ({
  verifyMetaSignature: (...a: unknown[]) => verifyMetaSignature(...a),
  verifyTelegramSecret: vi.fn(),
  verifyWidgetSignature: vi.fn(),
  verifyMetaSubscribe: vi.fn(),
}));
const resolveAutomation = vi.fn();
vi.mock("@/lib/webhooks/resolver", () => ({ resolveAutomation: (...a: unknown[]) => resolveAutomation(...a) }));
const loadChannelVerifySecret = vi.fn();
vi.mock("@/lib/webhooks/resolver-loader", () => ({
  loadChannelVerifySecret: (...a: unknown[]) => loadChannelVerifySecret(...a),
}));
const claimOnce = vi.fn();
vi.mock("@/lib/redis/idempotency", () => ({ claimOnce: (...a: unknown[]) => claimOnce(...a) }));
const fixedWindow = vi.fn();
vi.mock("@/lib/redis/rate-limit", () => ({ fixedWindow: (...a: unknown[]) => fixedWindow(...a) }));
const fireAndForgetForward = vi.fn();
vi.mock("@/lib/webhooks/forward", () => ({
  fireAndForgetForward: (...a: unknown[]) => fireAndForgetForward(...a),
}));

import { POST } from "@/app/webhooks/[channel]/[automationId]/route";

const AUTOMATION_ID = "11111111-1111-1111-1111-111111111111";

function reqWith(body: object) {
  return new Request(`http://localhost/webhooks/whatsapp/${AUTOMATION_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=x" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}
const params = Promise.resolve({ channel: "whatsapp", automationId: AUTOMATION_ID });
const liveRec = { automationId: AUTOMATION_ID, tenantId: "t1", status: "live", engineWebhookUrl: "http://engine/a1" };

beforeEach(() => {
  [verifyMetaSignature, resolveAutomation, loadChannelVerifySecret, claimOnce, fixedWindow, fireAndForgetForward].forEach((m) => m.mockReset());
  loadChannelVerifySecret.mockResolvedValue("secret");
});

describe("webhook gateway POST", () => {
  it("404 for a non-UUID automationId before any verify/resolve", async () => {
    verifyMetaSignature.mockReturnValue(true);
    const badParams = Promise.resolve({ channel: "whatsapp", automationId: "a1" });
    const res = await POST(reqWith({ entry: [] }), { params: badParams });
    expect(res.status).toBe(404);
    expect(resolveAutomation).not.toHaveBeenCalled();
    expect(verifyMetaSignature).not.toHaveBeenCalled();
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("401 on bad signature, no forward", async () => {
    verifyMetaSignature.mockReturnValue(false);
    const res = await POST(reqWith({ entry: [] }), { params });
    expect(res.status).toBe(401);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("200 + no forward for unknown automation", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(null);
    const res = await POST(reqWith({ entry: [] }), { params });
    expect(res.status).toBe(200);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("429 when rate-limited", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(liveRec);
    fixedWindow.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(reqWith({ entry: [] }), { params });
    expect(res.status).toBe(429);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("200 deduped + no forward for a repeated message id", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(liveRec);
    fixedWindow.mockResolvedValue({ allowed: true, remaining: 59 });
    claimOnce.mockResolvedValue(false);
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.1" }] } }] }] };
    const res = await POST(reqWith(body), { params });
    expect(res.status).toBe(200);
    expect(fireAndForgetForward).not.toHaveBeenCalled();
  });

  it("200 + forwards once on the happy path", async () => {
    verifyMetaSignature.mockReturnValue(true);
    resolveAutomation.mockResolvedValue(liveRec);
    fixedWindow.mockResolvedValue({ allowed: true, remaining: 59 });
    claimOnce.mockResolvedValue(true);
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.2" }] } }] }] };
    const res = await POST(reqWith(body), { params });
    expect(res.status).toBe(200);
    expect(fireAndForgetForward).toHaveBeenCalledTimes(1);
    expect(fireAndForgetForward).toHaveBeenCalledWith("http://engine/a1", "application/json", expect.any(String));
  });
});
