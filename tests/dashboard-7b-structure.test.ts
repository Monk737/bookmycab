import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

describe("7b pages exist", () => {
  for (const f of [
    "src/app/dashboard/automations/[automationId]/analytics/page.tsx",
    "src/app/dashboard/automations/[automationId]/config/page.tsx",
    "src/app/dashboard/automations/[automationId]/channels/page.tsx",
    "src/app/dashboard/team/page.tsx",
    "src/app/dashboard/billing/page.tsx",
    "src/app/dashboard/support/page.tsx",
  ]) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const fp = join(dir, name);
    return statSync(fp).isDirectory() ? tsxFiles(fp) : /\.(ts|tsx)$/.test(fp) ? [fp] : [];
  });
}

describe("7b brand safety", () => {
  it("no banned internal vocabulary on dashboard surfaces", () => {
    const banned = /\bn8n\b|\bCabLab\b/i;
    for (const d of ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard"]) {
      for (const f of tsxFiles(join(process.cwd(), d))) {
        expect(readFileSync(f, "utf8"), f).not.toMatch(banned);
      }
    }
  });
});

describe("7b service-role containment", () => {
  it("only the team server-action + team page reference the service-role key", () => {
    const allow = new Set([
      "src/app/dashboard/team/actions.ts",
      "src/app/dashboard/team/page.tsx",
    ].map((r) => join(process.cwd(), r)));
    for (const d of ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard", "src/app/api/orgs"]) {
      for (const f of tsxFiles(join(process.cwd(), d))) {
        if (allow.has(f)) continue;
        expect(readFileSync(f, "utf8"), `${f} must not reference the service-role key`).not.toMatch(/SERVICE_ROLE/);
      }
    }
  });
});

describe("0015 migration RLS", () => {
  it("enables RLS + tenant policies on both new tables", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0015_dashboard_config_support.sql"), "utf8");
    expect(sql).toMatch(/automation_config enable row level security/i);
    expect(sql).toMatch(/support_tickets\s+enable row level security/i);
    expect(sql.match(/tenant_users/gi)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
