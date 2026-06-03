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
