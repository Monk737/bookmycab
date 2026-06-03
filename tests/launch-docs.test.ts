import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const p = (rel: string) => join(process.cwd(), rel);

const DOCS: Record<string, string[]> = {
  "docs/runbooks/provisioning-sop.md": ["## Discovery", "## Provision the tenant", "## UAT", "## Go-live"],
  "docs/runbooks/credential-rotation.md": ["## When to rotate", "## Channel credentials", "## Dispatch credentials", "## Vault key"],
  "docs/runbooks/incident-response.md": ["## Severity levels", "## On-call", "## Communication", "## Post-incident"],
  "docs/sales/one-pager.md": ["## The problem", "## The solution", "## Channels", "## Pricing"],
};

describe("launch documentation", () => {
  for (const [file, headings] of Object.entries(DOCS)) {
    it(`${file} exists with its required sections`, () => {
      expect(existsSync(p(file)), file).toBe(true);
      const src = readFileSync(p(file), "utf8");
      for (const h of headings) expect(src.includes(h), `${file} → ${h}`).toBe(true);
    });
  }
  it("the customer-facing one-pager never names the internal tooling", () => {
    const src = readFileSync(p("docs/sales/one-pager.md"), "utf8").toLowerCase();
    for (const banned of ["n8n", "cablab"]) expect(src.includes(banned), banned).toBe(false);
  });
});
