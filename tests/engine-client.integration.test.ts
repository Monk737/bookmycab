import { describe, it, expect, beforeAll, vi } from "vitest";

// client.ts is `server-only`; stub it so it loads under the test runner
// (same pattern the rest of the suite uses for server-only modules).
vi.mock("server-only", () => ({}));

import { EngineClient } from "@/lib/engine/client";

const configured = Boolean(process.env.N8N_BASE_URL && process.env.N8N_API_KEY && process.env.N8N_TEST_WORKFLOW_ID);
const run = configured ? describe : describe.skip;

run("EngineClient (live n8n)", () => {
  let client: EngineClient;
  const wfId = process.env.N8N_TEST_WORKFLOW_ID as string;

  beforeAll(() => {
    client = new EngineClient(process.env.N8N_BASE_URL!.replace(/\/$/, ""), process.env.N8N_API_KEY!);
  });

  it("activate → isActive true, deactivate → isActive false", async () => {
    await client.activate(wfId);
    expect(await client.isActive(wfId)).toBe(true);
    await client.deactivate(wfId);
    expect(await client.isActive(wfId)).toBe(false);
  });

  it("listRuns returns an array", async () => {
    const runs = await client.listRuns(wfId, 5);
    expect(Array.isArray(runs)).toBe(true);
  });
});
