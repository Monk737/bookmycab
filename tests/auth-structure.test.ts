import { existsSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { evaluateAccess, AUTH_ROUTES, type Claims } from "../src/middleware/access";

// Resolve project root from this test file (tests/ -> ..).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const AUTH_DIR = join(ROOT, "src/app/(auth)");

// Map an auth route to its expected App Router page file.
function pageFileFor(route: string): string {
  return join(AUTH_DIR, route, "page.tsx");
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

// The five auth pages this epic ships.
const AUTH_PAGES = [
  "login",
  "forgot-password",
  "reset-password",
  "accept-invite",
  "mfa",
];

describe("auth site structure", () => {
  it("ships a page file for every auth page", () => {
    const missing = AUTH_PAGES.filter(
      (p) => !existsSync(join(AUTH_DIR, p, "page.tsx")),
    );
    expect(missing).toEqual([]);
  });

  it("ships a page for every AUTH_ROUTES entry guarded by access control", () => {
    const missing = AUTH_ROUTES.filter((route) => !existsSync(pageFileFor(route)));
    expect(missing).toEqual([]);
  });

  it("exposes no public signup or registration route anywhere under src/app", () => {
    const appDir = join(ROOT, "src/app");
    const banned = /(signup|sign-up|register)/i;
    const offenders = collectFiles(appDir).filter((f) => banned.test(f));
    expect(offenders).toEqual([]);
  });

  it("allows an aal1 Owner onto every auth route (no redirect loop)", () => {
    const aal1Owner: Claims = {
      sub: "u1",
      tenant_id: "org-1",
      role: "Owner",
      is_flowmo_staff: false,
      aal: "aal1",
      automation_restrictions: [],
    };
    for (const route of AUTH_ROUTES) {
      expect(evaluateAccess(route, aal1Owner)).toEqual({ kind: "allow" });
    }
  });
});
