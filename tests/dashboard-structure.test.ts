import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const p = (rel: string) => join(root, rel);

describe("dashboard 7a — files exist", () => {
  const files = [
    "src/app/dashboard/layout.tsx",
    "src/components/dashboard/dashboard-shell.tsx",
    "src/components/dashboard/automation-subnav.tsx",
    "src/components/dashboard/status-badge.tsx",
    "src/components/dashboard/channel-icon.tsx",
    "src/components/dashboard/kpi-strip.tsx",
    "src/components/dashboard/data-table.tsx",
    "src/components/dashboard/slide-over.tsx",
    "src/components/dashboard/filter-bar.tsx",
    "src/components/dashboard/charts/trend-chart.tsx",
    "src/components/dashboard/charts/donut-chart.tsx",
    "src/components/dashboard/charts/bar-chart.tsx",
    "src/app/dashboard/automations/[automationId]/layout.tsx",
    "src/app/dashboard/automations/[automationId]/page.tsx",
    "src/app/dashboard/automations/[automationId]/live-feed.tsx",
    "src/app/dashboard/automations/[automationId]/bookings/page.tsx",
    "src/app/dashboard/automations/[automationId]/conversations/page.tsx",
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

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const fp = join(dir, name);
    return statSync(fp).isDirectory() ? tsxFiles(fp) : /\.(ts|tsx)$/.test(fp) ? [fp] : [];
  });
}

describe("dashboard brand safety", () => {
  it("no banned internal vocabulary in dashboard surfaces", () => {
    const banned = /\bn8n\b|\bCabLab\b/i;
    for (const d of ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard"]) {
      for (const f of tsxFiles(p(d))) {
        expect(readFileSync(f, "utf8"), `${f}`).not.toMatch(banned);
      }
    }
  });
});

describe("no service-role key on tenant surfaces", () => {
  it("dashboard + api/orgs never reference the service-role key", () => {
    for (const d of ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard", "src/app/api/orgs"]) {
      for (const f of tsxFiles(p(d))) {
        expect(readFileSync(f, "utf8"), `${f} must not use the service-role key`).not.toMatch(/SERVICE_ROLE/);
      }
    }
  });
});

describe("RLS policies present on read tables (regression guard)", () => {
  it("0005 migration references each read table in a policy", () => {
    const sql = readFileSync(p("supabase/migrations/0005_rls_policies.sql"), "utf8");
    for (const t of ["bookings", "conversations", "messages", "automation_runs", "channels", "automations"]) {
      expect(sql, `policy for ${t}`).toMatch(new RegExp(`on\\s+public\\.${t}\\b|on\\s+${t}\\b`, "i"));
    }
  });
});
