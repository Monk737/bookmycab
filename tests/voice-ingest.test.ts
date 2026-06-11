import { describe, it, expect } from "vitest";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { parseIngestBody } from "@/lib/voice/ingest-schema";

describe("bearerMatches", () => {
  it("true when the bearer token equals the secret", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
  });
  it("false on wrong token", () => {
    expect(bearerMatches("Bearer nope", "s3cret")).toBe(false);
  });
  it("false on missing/malformed header", () => {
    expect(bearerMatches(null, "s3cret")).toBe(false);
    expect(bearerMatches("s3cret", "s3cret")).toBe(false); // no "Bearer " prefix
    expect(bearerMatches("Bearer ", "s3cret")).toBe(false);
  });
  it("false when secret is empty (never matches)", () => {
    expect(bearerMatches("Bearer ", "")).toBe(false);
    expect(bearerMatches("Bearer x", "")).toBe(false);
  });
  it("is length-safe (different lengths return false, no throw)", () => {
    expect(bearerMatches("Bearer short", "muchlongersecret")).toBe(false);
  });
});

describe("parseIngestBody", () => {
  const ok = {
    provider_call_id: "call_1",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    automation_id: "22222222-2222-2222-2222-222222222222",
    outcome: "booked",
  };
  it("accepts a minimal valid body", () => {
    const r = parseIngestBody(ok);
    expect(r.success).toBe(true);
  });
  it("rejects an invalid outcome", () => {
    expect(parseIngestBody({ ...ok, outcome: "exploded" }).success).toBe(false);
  });
  it("rejects a non-uuid tenant_id", () => {
    expect(parseIngestBody({ ...ok, tenant_id: "nope" }).success).toBe(false);
  });
  it("requires provider_call_id", () => {
    const { provider_call_id, ...rest } = ok;
    void provider_call_id;
    expect(parseIngestBody(rest).success).toBe(false);
  });
});
