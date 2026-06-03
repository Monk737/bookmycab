import { describe, it, expect, vi, afterEach } from "vitest";
import { MemorySink, StructuredLogSink, noopSink, setSink, getSink, resetSink } from "@/lib/observability/sink";

afterEach(() => resetSink());

describe("sink registry", () => {
  it("defaults to the no-op sink", () => {
    expect(getSink()).toBe(noopSink);
  });

  it("setSink swaps the active sink; resetSink restores the no-op", () => {
    const mem = new MemorySink();
    setSink(mem);
    expect(getSink()).toBe(mem);
    resetSink();
    expect(getSink()).toBe(noopSink);
  });
});

describe("MemorySink", () => {
  it("captures spans, metrics, and errors in order", () => {
    const mem = new MemorySink();
    mem.span({ name: "s", attributes: {}, durationMs: 1, status: "ok" });
    mem.metric({ name: "m", kind: "counter", value: 1, attributes: {} });
    mem.error({ name: "Error", message: "boom", attributes: {} });
    expect(mem.spans).toHaveLength(1);
    expect(mem.metrics).toHaveLength(1);
    expect(mem.errors[0].message).toBe("boom");
  });
});

describe("StructuredLogSink", () => {
  it("writes one tagged JSON line per record to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = new StructuredLogSink();
    log.span({ name: "s", attributes: { a: 1 }, durationMs: 2, status: "ok" });
    log.metric({ name: "m", kind: "histogram", value: 3, attributes: {} });
    expect(spy).toHaveBeenCalledTimes(2);
    const first = JSON.parse(spy.mock.calls[0][0] as string);
    expect(first).toMatchObject({ t: "span", name: "s", status: "ok" });
    spy.mockRestore();
  });
});
