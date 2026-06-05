// tests/admin-platform-config.test.ts
import { describe, it, expect } from "vitest";
import { validateSender, validateApp } from "@/lib/admin/platform-config";

describe("validateSender", () => {
  it("accepts a valid email sender", () => {
    expect(validateSender({ type: "email", identifier: "hello@bookmycab.com" }).ok).toBe(true);
  });
  it("rejects an unknown type", () => {
    expect(validateSender({ type: "pigeon" as never, identifier: "x" }).ok).toBe(false);
  });
  it("rejects an empty identifier", () => {
    expect(validateSender({ type: "sms", identifier: "  " }).ok).toBe(false);
  });
});

describe("validateApp", () => {
  it("accepts a provider + identifier", () => {
    expect(validateApp({ provider: "meta", identifier: "wa-123" }).ok).toBe(true);
  });
  it("rejects missing provider", () => {
    expect(validateApp({ provider: "", identifier: "x" }).ok).toBe(false);
  });
});
