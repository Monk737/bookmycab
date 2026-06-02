// tests/demo-session.test.ts
import { describe, it, expect } from "vitest";
import type { Claims } from "@/middleware/access";
import { isDemoUser, blockIfDemo } from "@/lib/demo/session";

function makeClaims(overrides: Partial<Claims> = {}): Claims {
  return {
    sub: "user-1",
    tenant_id: "tenant-1",
    role: "Viewer",
    is_flowmo_staff: false,
    aal: "aal1",
    automation_restrictions: [],
    is_demo: false,
    ...overrides,
  };
}

describe("isDemoUser", () => {
  it("returns true when is_demo is true", () => {
    expect(isDemoUser(makeClaims({ is_demo: true }))).toBe(true);
  });

  it("returns false when is_demo is false", () => {
    expect(isDemoUser(makeClaims({ is_demo: false }))).toBe(false);
  });

  it("returns false for null claims", () => {
    expect(isDemoUser(null)).toBe(false);
  });
});

describe("blockIfDemo", () => {
  it("returns null for non-demo session", () => {
    expect(blockIfDemo(makeClaims({ is_demo: false }))).toBeNull();
  });

  it("returns null for null claims", () => {
    expect(blockIfDemo(null)).toBeNull();
  });

  it("returns a 403 Response for demo session", async () => {
    const res = blockIfDemo(makeClaims({ is_demo: true }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Read-only in demo mode.");
  });
});
