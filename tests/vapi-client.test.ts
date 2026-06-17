// tests/vapi-client.test.ts
// The Vapi client merges a new system prompt into the assistant's existing
// model.messages without dropping other roles/config, and PATCHes it back.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Provide a known Vapi config without depending on real env validation.
// vi.mock is hoisted above the import below, so @/env resolves to this stub.
vi.mock("@/env", () => ({
  env: { VAPI_API_KEY: "vapi-test-key", VAPI_BASE_URL: "https://api.vapi.ai" },
}));

import { extractSystemPrompt, setSystemPrompt, getSystemPrompt } from "@/lib/voice/vapi";

describe("vapi client", () => {
  it("extracts the system message content", () => {
    const a = { id: "a1", model: { messages: [{ role: "system", content: "old" }, { role: "user", content: "hi" }] } };
    expect(extractSystemPrompt(a)).toBe("old");
  });

  it("returns '' when there is no system message", () => {
    expect(extractSystemPrompt({ id: "a1", model: { messages: [{ role: "user", content: "hi" }] } })).toBe("");
    expect(extractSystemPrompt({ id: "a1" })).toBe("");
  });

  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { fetchSpy = vi.spyOn(globalThis, "fetch"); });
  afterEach(() => { fetchSpy.mockRestore(); });

  it("getSystemPrompt GETs the assistant with bearer auth", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "a1", model: { messages: [{ role: "system", content: "live" }] } }), { status: 200 }),
    );
    const prompt = await getSystemPrompt("a1");
    expect(prompt).toBe("live");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/assistant/a1");
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer vapi-test-key" });
  });

  it("setSystemPrompt GETs then PATCHes a merged model.messages", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: "a1",
          model: { provider: "openai", model: "gpt-4o", messages: [{ role: "system", content: "old" }, { role: "user", content: "ctx" }] },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await setSystemPrompt("a1", "brand new prompt");

    const [, patchInit] = fetchSpy.mock.calls[1];
    expect((patchInit as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((patchInit as RequestInit).body as string);
    // Preserves other model fields + the non-system message, swaps system content.
    expect(body.model.provider).toBe("openai");
    expect(body.model.messages).toEqual([
      { role: "system", content: "brand new prompt" },
      { role: "user", content: "ctx" },
    ]);
  });

  it("throws a clear error on a non-2xx Vapi response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await expect(getSystemPrompt("missing")).rejects.toThrow(/Vapi/);
  });
});
