import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

// `server-only` throws outside Next.js' react-server condition (e.g. Vitest),
// so stub it the same way the admin test suite does.
vi.mock("server-only", () => ({}));

import {
  verifyMetaSignature,
  verifyTelegramSecret,
  verifyWidgetSignature,
  verifyMetaSubscribe,
} from "@/lib/webhooks/signatures";

const rawBody = JSON.stringify({ hello: "world" });

describe("verifyMetaSignature", () => {
  const appSecret = "meta-app-secret";
  const good = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");

  it("accepts a correct sha256 signature", () => {
    expect(verifyMetaSignature(rawBody, good, appSecret)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyMetaSignature(rawBody + "x", good, appSecret)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifyMetaSignature(rawBody, good, "other")).toBe(false);
  });
  it("rejects a missing/empty header", () => {
    expect(verifyMetaSignature(rawBody, "", appSecret)).toBe(false);
    expect(verifyMetaSignature(rawBody, null, appSecret)).toBe(false);
  });
  it("rejects a malformed header (no sha256= prefix)", () => {
    expect(verifyMetaSignature(rawBody, "deadbeef", appSecret)).toBe(false);
  });
});

describe("verifyTelegramSecret", () => {
  it("accepts a matching secret token (constant-time)", () => {
    expect(verifyTelegramSecret("abc123", "abc123")).toBe(true);
  });
  it("rejects a mismatch and empty/null", () => {
    expect(verifyTelegramSecret("abc123", "nope")).toBe(false);
    expect(verifyTelegramSecret("", "abc123")).toBe(false);
    expect(verifyTelegramSecret(null, "abc123")).toBe(false);
  });
});

describe("verifyWidgetSignature", () => {
  const key = "widget-signing-key";
  const good = createHmac("sha256", key).update(rawBody).digest("hex");
  it("accepts a correct hex signature", () => {
    expect(verifyWidgetSignature(rawBody, good, key)).toBe(true);
  });
  it("rejects tampered/empty", () => {
    expect(verifyWidgetSignature(rawBody, good, "other")).toBe(false);
    expect(verifyWidgetSignature(rawBody, "", key)).toBe(false);
  });
  it("rejects a null header (parity with Meta null-header case)", () => {
    expect(verifyWidgetSignature(rawBody, null, key)).toBe(false);
  });
});

describe("verifyMetaSubscribe", () => {
  it("returns the challenge when mode+token match", () => {
    expect(
      verifyMetaSubscribe(
        { "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "12345" },
        "vt",
      ),
    ).toBe("12345");
  });
  it("returns null on token mismatch or wrong mode", () => {
    expect(
      verifyMetaSubscribe(
        { "hub.mode": "subscribe", "hub.verify_token": "bad", "hub.challenge": "1" },
        "vt",
      ),
    ).toBeNull();
    expect(
      verifyMetaSubscribe(
        { "hub.mode": "unsubscribe", "hub.verify_token": "vt", "hub.challenge": "1" },
        "vt",
      ),
    ).toBeNull();
  });
});
