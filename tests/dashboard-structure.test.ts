import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const p = (rel: string) => join(root, rel);

describe("dashboard 7a — files exist", () => {
  const files = [
    "src/app/dashboard/layout.tsx",
    "src/components/dashboard/dashboard-shell.tsx",
    "src/components/dashboard/automation-subnav.tsx",
  ];
  for (const f of files) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});

describe("dashboard 7a — recharts installed", () => {
  it("is a dependency", () => {
    const pkg = JSON.parse(readFileSync(p("package.json"), "utf8"));
    expect(pkg.dependencies?.recharts ?? pkg.devDependencies?.recharts).toBeTruthy();
  });
});
