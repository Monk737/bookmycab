import { describe, it, expect } from "vitest";
import { buildEngineDeeplink } from "@/lib/admin/engine-links";

describe("buildEngineDeeplink", () => {
  const base = "https://engine.internal";
  const wf = "wf_123";
  const proj = "proj_abc";

  it("builds a workflow URL from base + workflowId", () => {
    expect(buildEngineDeeplink(base, null, wf)).toBe(
      "https://engine.internal/workflow/wf_123",
    );
  });

  it("includes the project segment when projectId is present", () => {
    expect(buildEngineDeeplink(base, proj, wf)).toBe(
      "https://engine.internal/projects/proj_abc/workflow/wf_123",
    );
  });

  it("returns null when baseUrl is undefined", () => {
    expect(buildEngineDeeplink(undefined, proj, wf)).toBeNull();
  });

  it("returns null when workflowId is absent (null or undefined)", () => {
    expect(buildEngineDeeplink(base, proj, null)).toBeNull();
    expect(buildEngineDeeplink(base, proj, undefined)).toBeNull();
  });

  it("returns null when both base and workflowId are absent", () => {
    expect(buildEngineDeeplink(undefined, null, null)).toBeNull();
  });

  it("builds a workflow URL even when projectId is undefined", () => {
    expect(buildEngineDeeplink(base, undefined, wf)).toBe(
      "https://engine.internal/workflow/wf_123",
    );
  });

  it("strips a single trailing slash from the base", () => {
    expect(buildEngineDeeplink("https://engine.internal/", null, wf)).toBe(
      "https://engine.internal/workflow/wf_123",
    );
  });

  it("strips multiple trailing slashes from the base", () => {
    expect(buildEngineDeeplink("https://engine.internal///", proj, wf)).toBe(
      "https://engine.internal/projects/proj_abc/workflow/wf_123",
    );
  });
});
