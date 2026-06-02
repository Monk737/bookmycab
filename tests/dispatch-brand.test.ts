import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Recursively list .ts files under a dir. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("dispatch layer brand safety", () => {
  it("contains no banned internal/engine vocabulary", () => {
    const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
    for (const file of tsFiles(join(process.cwd(), "src/lib/dispatch"))) {
      const text = readFileSync(file, "utf8");
      expect(text, `${file} contains banned vocabulary`).not.toMatch(banned);
    }
  });

  it("re-exports the public surface from index.ts", async () => {
    const mod = await import("@/lib/dispatch");
    expect(typeof mod.getDispatchAdapter).toBe("function");
    expect(typeof mod.lhrZoneForTerminal).toBe("function");
    expect(typeof mod.airlineForFlightNumber).toBe("function");
    expect(typeof mod.pickupTimeFromArrival).toBe("function");
    expect(typeof mod.DispatchError).toBe("function");
  });
});
