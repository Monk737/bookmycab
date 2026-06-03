import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const p = (rel: string) => join(process.cwd(), rel);

describe("legal layout framing", () => {
  it("no longer describes the legal pages as Epic 12 stubs", () => {
    const src = readFileSync(p("src/components/marketing/legal-page.tsx"), "utf8");
    expect(src).not.toMatch(/stub/i);
    expect(src).not.toMatch(/Epic 12/i);
  });
});

describe("legal pages carry launch-ready sections", () => {
  const required: Record<string, string[]> = {
    privacy: ["Security", "Your rights and complaints"],
    terms: ["Liability", "Governing law"],
    dpa: ["International transfers", "Personal-data breaches"],
    cookies: ["Cookies we set"],
  };
  for (const [page, headings] of Object.entries(required)) {
    it(`${page} includes ${headings.join(", ")}`, () => {
      const src = readFileSync(p(`src/app/(marketing)/${page}/page.tsx`), "utf8");
      for (const h of headings) expect(src.includes(h), h).toBe(true);
    });
  }
});
