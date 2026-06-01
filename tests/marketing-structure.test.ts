import { existsSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { MARKETING_ROUTES } from "../src/lib/marketing/nav";
import { PUBLIC_PAGES } from "../src/middleware/access";

// Resolve project root from this test file (tests/ -> ..).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MARKETING_DIR = join(ROOT, "src/app/(marketing)");

// Map a public route to its expected App Router page file.
function pageFileFor(route: string): string {
  const sub = route === "/" ? "" : route;
  return join(MARKETING_DIR, sub, "page.tsx");
}

// Recursively collect every file path under a directory (empty if absent).
function collectFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (stat.isFile()) {
      files.push(full);
    }
  }
  return files;
}

describe("marketing site structure", () => {
  it("ships a page for every public marketing route", () => {
    const missing = MARKETING_ROUTES.filter((route) => !existsSync(pageFileFor(route)));
    expect(missing).toEqual([]);
  });

  it("keeps every marketing route within the public-path whitelist", () => {
    const notPublic = MARKETING_ROUTES.filter((route) => !PUBLIC_PAGES.has(route));
    expect(notPublic).toEqual([]);
  });

  it("exposes no public signup or registration route anywhere under src/app", () => {
    const appDir = join(ROOT, "src/app");
    const banned = /(signup|sign-up|register)/i;
    const offenders = collectFiles(appDir).filter((f) => banned.test(f));
    expect(offenders).toEqual([]);
  });
});
