import { describe, it, expect, vi } from "vitest";

// impersonation-cookie.ts is server-only and imports `@/env` (which throws
// without runtime env, and reads the service-role HMAC key). Stub both so the
// PURE sign/verify helpers load under the test runner. `next/headers` is NOT
// imported by these helpers, so no cookies() mock is needed — only
// readActiveImpersonation() touches cookies and is not exercised here.
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: "test-hmac-key" },
}));

import {
  serializeImpersonation,
  verifyImpersonation,
} from "@/lib/admin/impersonation-cookie";
import type { ImpersonationRecord } from "@/lib/admin/impersonation";

const record: ImpersonationRecord = {
  staffUserId: "staff-1",
  tenantId: "tenant-1",
  targetUserId: "user-1",
  reason: "Investigating a booking dispute",
  mode: "read_only",
  startedAt: 1_000,
  expiresAt: 1_000 + 15 * 60 * 1000,
};

describe("impersonation cookie HMAC verify", () => {
  it("round-trips a signed record", () => {
    const verified = verifyImpersonation(serializeImpersonation(record));
    expect(verified).toEqual(record);
  });

  it("rejects a tampered payload (valid JSON, stale signature)", () => {
    const signed = serializeImpersonation(record);
    const [, sig] = signed.split(".");
    // Forge a new payload (extend expiry) but keep the old signature.
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...record, expiresAt: record.expiresAt + 60 * 60 * 1000 }),
      "utf8",
    ).toString("base64url");
    expect(verifyImpersonation(`${forgedPayload}.${sig}`)).toBeNull();
  });

  it("rejects a garbage / unsigned value", () => {
    expect(verifyImpersonation("not-a-signed-cookie")).toBeNull();
    expect(verifyImpersonation(JSON.stringify(record))).toBeNull();
  });

  it("rejects an authentically-signed but shape-incomplete record", () => {
    // Sign a payload missing staffUserId/reason — HMAC is valid, shape guard
    // must still reject it (defense-in-depth).
    const partial = { tenantId: "t", targetUserId: "u", expiresAt: 1 };
    const signed = serializeImpersonation(partial as unknown as ImpersonationRecord);
    expect(verifyImpersonation(signed)).toBeNull();
  });
});
