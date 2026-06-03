import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { N8N_BASE_URL: "http://engine", N8N_API_KEY: "k" } }));

import { EngineClient } from "@/lib/engine/client";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("engine client instrumentation", () => {
  it("records an engine_request_ms histogram + engine.request span on success", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ active: true }), { status: 200 })) as unknown as typeof fetch;
    const client = new EngineClient("http://engine", "k", fetcher);
    await client.isActive("wf1");
    expect(mem.metrics.find((m) => m.name === "engine_request_ms")).toMatchObject({ kind: "histogram", attributes: { status: "ok" } });
    expect(mem.spans.find((s) => s.name === "engine.request")).toBeTruthy();
  });

  it("records status=error when the engine returns a non-2xx", async () => {
    const fetcher = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const client = new EngineClient("http://engine", "k", fetcher);
    await expect(client.isActive("wf1")).rejects.toThrow();
    expect(mem.metrics.find((m) => m.name === "engine_request_ms")).toMatchObject({ attributes: { status: "error" } });
  });
});
