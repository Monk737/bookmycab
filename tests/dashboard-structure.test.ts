import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const p = (rel: string) => join(root, rel);

describe("dashboard — two-product structure exists", () => {
  const files = [
    "src/app/dashboard/layout.tsx",
    "src/components/dashboard/dashboard-shell.tsx",
    "src/components/dashboard/channel-icon.tsx",
    "src/components/dashboard/ui.tsx",
    // The lean nav target pages: Overview / Chat / Voice / Billing / Team / Support.
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/chat/page.tsx",
    "src/app/dashboard/voice/page.tsx",
    "src/app/dashboard/billing/page.tsx",
    "src/app/dashboard/team/page.tsx",
    "src/app/dashboard/support/page.tsx",
    // Product analytics data + view layers.
    "src/lib/dashboard/product-overview.ts",
    "src/lib/dashboard/chat-analytics.ts",
    "src/components/dashboard/voice/calls-trend.tsx",
    "src/components/dashboard/chat/conversations-trend.tsx",
  ];
  for (const f of files) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});

describe("dashboard — legacy automation-scoped routes removed", () => {
  // The two-product revamp retired the per-automation subtree and the gated
  // single-feature sections. They must not return as dead routes.
  const removed = [
    "src/app/dashboard/automations",
    "src/components/dashboard/automation-subnav.tsx",
    "src/app/dashboard/alerts",
    "src/app/dashboard/connect",
    "src/app/dashboard/copilot",
    "src/app/dashboard/customers",
    "src/app/dashboard/dispatch",
    "src/app/dashboard/integrations",
    "src/app/dashboard/intel",
    "src/app/dashboard/invoicing",
    "src/app/dashboard/liveops",
    "src/app/dashboard/reports",
  ];
  for (const f of removed) {
    it(`removed: ${f}`, () => expect(existsSync(p(f)), f).toBe(false));
  }
});

describe("dashboard — recharts installed", () => {
  it("is a dependency", () => {
    const pkg = JSON.parse(readFileSync(p("package.json"), "utf8"));
    expect(pkg.dependencies?.recharts ?? pkg.devDependencies?.recharts).toBeTruthy();
  });
});

describe("0015 migration RLS (regression guard)", () => {
  it("enables RLS + tenant policies on the config + support tables", () => {
    const sql = readFileSync(p("supabase/migrations/0015_dashboard_config_support.sql"), "utf8");
    expect(sql).toMatch(/automation_config enable row level security/i);
    expect(sql).toMatch(/support_tickets\s+enable row level security/i);
    expect(sql.match(/tenant_users/gi)?.length ?? 0).toBeGreaterThanOrEqual(2);
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
    // Allowlist: the Epic-7b team surface legitimately uses the service-role
    // client server-side — `team/actions.ts` for Owner-gated invite/role/revoke,
    // and `team/page.tsx` for the Owner-gated audit-log read (audit_log RLS denies
    // tenant SELECT). Both are security-reviewed and never expose the key client-side.
    const allow = new Set(
      ["src/app/dashboard/team/actions.ts", "src/app/dashboard/team/page.tsx"].map((r) => p(r)),
    );
    for (const d of ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard", "src/app/api/orgs"]) {
      for (const f of tsxFiles(p(d))) {
        if (allow.has(f)) continue;
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
