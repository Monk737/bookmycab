// tests/integrations-crypto.test.ts
import { describe, it, expect } from "vitest";
import { generateApiKey, hashKey, signWebhook, matchWebhooks } from "@/lib/integrations/crypto";

describe("generateApiKey", () => {
  it("produces a prefix, raw key starting with the prefix, and a matching hash", () => {
    const k = generateApiKey();
    expect(k.raw.startsWith("cab_")).toBe(true);
    expect(k.prefix.length).toBeGreaterThanOrEqual(8);
    expect(k.raw.startsWith(k.prefix)).toBe(true);
    expect(k.hash).toBe(hashKey(k.raw));
  });
  it("generates distinct keys each call", () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });
});

describe("hashKey", () => {
  it("is deterministic (sha256 hex, 64 chars)", () => {
    expect(hashKey("cab_abc")).toBe(hashKey("cab_abc"));
    expect(hashKey("cab_abc")).toHaveLength(64);
    expect(hashKey("cab_abc")).not.toBe(hashKey("cab_xyz"));
  });
});

describe("signWebhook", () => {
  it("is a deterministic HMAC-SHA256 hex of the payload+secret", () => {
    const a = signWebhook('{"x":1}', "secret");
    expect(a).toBe(signWebhook('{"x":1}', "secret"));
    expect(a).toHaveLength(64);
    expect(a).not.toBe(signWebhook('{"x":1}', "other"));
  });
});

describe("matchWebhooks", () => {
  const hooks = [
    { id: "1", url: "u1", events: ["booking.created"], enabled: true },
    { id: "2", url: "u2", events: ["booking.cancelled"], enabled: true },
    { id: "3", url: "u3", events: ["booking.created"], enabled: false },
    { id: "4", url: "u4", events: ["*"], enabled: true },
  ];
  it("returns enabled hooks subscribed to the event (or wildcard)", () => {
    const m = matchWebhooks(hooks, "booking.created").map((h) => h.id);
    expect(m).toContain("1");
    expect(m).toContain("4");
    expect(m).not.toContain("2");
    expect(m).not.toContain("3");
  });
});
