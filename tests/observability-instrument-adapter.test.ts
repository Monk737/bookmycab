import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { instrumentAdapter } from "@/lib/observability/instrument-adapter";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

// Minimal fake adapter exercising one ok method and one throwing method.
const fakeAdapter = {
  async getQuote() { return { fare: 10 }; },
  async createBooking() { throw new Error("dispatch down"); },
} as unknown as import("@/lib/dispatch/types").DispatchAdapter;

describe("instrumentAdapter", () => {
  it("records dispatch_latency_ms with adapter/op/status=ok and returns the result", async () => {
    const wrapped = instrumentAdapter(fakeAdapter, "autocab");
    const q = await wrapped.getQuote({} as never);
    expect(q).toMatchObject({ fare: 10 });
    const m = mem.metrics.find((x) => x.name === "dispatch_latency_ms");
    expect(m).toMatchObject({ kind: "histogram", attributes: { adapter: "autocab", op: "getQuote", status: "ok" } });
  });

  it("records status=error and re-throws on failure", async () => {
    const wrapped = instrumentAdapter(fakeAdapter, "autocab");
    await expect(wrapped.createBooking({} as never)).rejects.toThrow("dispatch down");
    const m = mem.metrics.find((x) => x.attributes.op === "createBooking");
    expect(m).toMatchObject({ attributes: { adapter: "autocab", status: "error" } });
    expect(mem.errors[0]).toMatchObject({ message: "dispatch down" });
  });
});
