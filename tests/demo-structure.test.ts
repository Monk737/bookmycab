// tests/demo-structure.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");

describe("Epic 9: Demo Tenant file structure", () => {
  it("migration 0016 exists", () => {
    expect(existsSync(`${root}/supabase/migrations/0016_demo_claims.sql`)).toBe(true);
  });

  it("demo route exists", () => {
    expect(existsSync(`${root}/src/app/demo/route.ts`)).toBe(true);
  });

  it("demo session helpers exist", () => {
    expect(existsSync(`${root}/src/lib/demo/session.ts`)).toBe(true);
  });

  it("seed script exists", () => {
    expect(existsSync(`${root}/scripts/seed-demo.ts`)).toBe(true);
  });

  it("reset Edge Function exists", () => {
    expect(existsSync(`${root}/supabase/functions/reset-demo/index.ts`)).toBe(true);
  });

  it("demo banner component exists", () => {
    expect(existsSync(`${root}/src/components/dashboard/demo-banner.tsx`)).toBe(true);
  });

  it("seed script contains required markers", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(resolve(root, "scripts/seed-demo.ts"), "utf-8");
    expect(src).toContain("DEMO_TENANT_ID");
    expect(src).toContain("seed-demo");
    expect(src).toContain("is_demo: true");
  });
});
