import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { withSpan, errMessage } from "@/lib/observability/telemetry";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("withSpan", () => {
  it("records an ok span with attributes and a non-negative duration, returning the value", async () => {
    const out = await withSpan("work", { kind: "test" }, async () => 42);
    expect(out).toBe(42);
    expect(mem.spans).toHaveLength(1);
    expect(mem.spans[0]).toMatchObject({ name: "work", status: "ok", attributes: { kind: "test" } });
    expect(mem.spans[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records an error span and re-throws the original error", async () => {
    await expect(
      withSpan("boom", {}, async () => { throw new Error("nope"); }),
    ).rejects.toThrow("nope");
    expect(mem.spans[0]).toMatchObject({ name: "boom", status: "error", error: "nope" });
  });
});

describe("errMessage", () => {
  it("extracts message from Error and stringifies non-errors", () => {
    expect(errMessage(new Error("x"))).toBe("x");
    expect(errMessage("y")).toBe("y");
  });
});
