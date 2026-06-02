import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
const p = (rel: string) => join(process.cwd(), rel);

describe("7b chart components exist", () => {
  for (const f of [
    "src/components/dashboard/charts/funnel-chart.tsx",
    "src/components/dashboard/charts/heatmap.tsx",
    "src/components/dashboard/charts/horizontal-bar-chart.tsx",
  ]) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});
