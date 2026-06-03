import { describe, it, expect, afterEach, vi } from "vitest";

// Hoist the sink mock so both the static import below and init.ts's import of
// "./sink" resolve to the same in-memory registry across module resets.
vi.mock("@/lib/observability/sink", async (importOriginal) => {
  return await importOriginal();
});

import { getSink, resetSink, noopSink, StructuredLogSink } from "@/lib/observability/sink";

afterEach(() => { resetSink(); vi.resetModules(); vi.unstubAllEnvs(); });

describe("initObservability", () => {
  it("leaves the no-op sink when OBSERVABILITY_STDOUT is unset", async () => {
    vi.doMock("@/env", () => ({ env: { OBSERVABILITY_STDOUT: undefined } }));
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();
    expect(getSink()).toBe(noopSink);
  });

  it("installs the StructuredLogSink when OBSERVABILITY_STDOUT='true'", async () => {
    vi.stubEnv("OBSERVABILITY_STDOUT", "true");
    vi.doMock("@/env", () => ({ env: { OBSERVABILITY_STDOUT: "true" } }));
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();
    expect(getSink()).toBeInstanceOf(StructuredLogSink);
  });
});
