import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { incCounter, recordHistogram } from "@/lib/observability/metrics";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("incCounter", () => {
  it("emits a counter metric defaulting to value 1", () => {
    incCounter("webhook_inbound_total", { channel: "whatsapp", status: "forwarded" });
    expect(mem.metrics[0]).toEqual({
      name: "webhook_inbound_total", kind: "counter", value: 1,
      attributes: { channel: "whatsapp", status: "forwarded" },
    });
  });
  it("accepts an explicit increment", () => {
    incCounter("c", {}, 5);
    expect(mem.metrics[0].value).toBe(5);
  });
});

describe("recordHistogram", () => {
  it("emits a histogram metric with the given value and attributes", () => {
    recordHistogram("webhook_ack_ms", 123, { channel: "telegram" });
    expect(mem.metrics[0]).toEqual({
      name: "webhook_ack_ms", kind: "histogram", value: 123, attributes: { channel: "telegram" },
    });
  });
});
