import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { reportError, redactAttrs } from "@/lib/observability/error-reporting";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("redactAttrs", () => {
  it("masks PII-ish keys and coerces values to primitives", () => {
    const out = redactAttrs({ phone: "+447700900000", channel: "whatsapp", count: 3, ok: true, blob: { a: 1 } });
    expect(out.phone).toBe("[redacted]");
    expect(out.channel).toBe("whatsapp");
    expect(out.count).toBe(3);
    expect(out.ok).toBe(true);
    expect(out.blob).toBe("[object Object]");
  });

  it("masks delimited secrets but leaves operational keys readable", () => {
    const out = redactAttrs({
      api_key: "sk-123", secret_key: "x", customer_name: "Jo", passenger_name: "Sam",
      adapterName: "autocab", channelName: "whatsapp", op: "getQuote",
    });
    expect(out.api_key).toBe("[redacted]");
    expect(out.secret_key).toBe("[redacted]");
    expect(out.customer_name).toBe("[redacted]");
    expect(out.passenger_name).toBe("[redacted]");
    // camelCase operational keys must stay debuggable
    expect(out.adapterName).toBe("autocab");
    expect(out.channelName).toBe("whatsapp");
    expect(out.op).toBe("getQuote");
  });
});

describe("reportError", () => {
  it("forwards Error name/message with redacted attributes", () => {
    reportError(new Error("dispatch failed"), { adapter: "autocab", customer_name: "Jo" });
    expect(mem.errors[0]).toMatchObject({
      name: "Error", message: "dispatch failed",
      attributes: { adapter: "autocab", customer_name: "[redacted]" },
    });
  });
  it("wraps non-Error throwables", () => {
    reportError("string failure");
    expect(mem.errors[0]).toMatchObject({ name: "Error", message: "string failure" });
  });
});
