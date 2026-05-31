import { describe, it, expect } from "vitest";
import { withPostgres } from "./helpers/db";

async function columnDefault(table: string, column: string): Promise<string | null> {
  return withPostgres(async (c) => {
    const { rows } = await c.query(
      `select column_default from information_schema.columns
       where table_schema='public' and table_name=$1 and column_name=$2`,
      [table, column],
    );
    return rows[0]?.column_default ?? null;
  });
}

async function checkClause(table: string): Promise<string[]> {
  return withPostgres(async (c) => {
    const { rows } = await c.query(
      `select cc.check_clause
       from information_schema.table_constraints tc
       join information_schema.check_constraints cc using (constraint_schema, constraint_name)
       where tc.table_schema='public' and tc.table_name=$1`,
      [table],
    );
    return rows.map((r) => r.check_clause as string);
  });
}

describe("0001 core tenant schema", () => {
  it("creates tenants with multi-currency and rolling_monthly renewal default", async () => {
    const checks = (await checkClause("tenants")).join(" | ");
    expect(checks).toContain("GBP");
    expect(checks).toContain("EUR");
    expect(checks).toContain("USD");
    const renewal = await columnDefault("tenants", "renewal_mode");
    expect(renewal).toContain("rolling_monthly");
  });

  it("creates tenant_users with role + automation_restrictions", async () => {
    const checks = (await checkClause("tenant_users")).join(" | ");
    expect(checks).toContain("Owner");
    expect(checks).toContain("Viewer");
    const def = await columnDefault("tenant_users", "automation_restrictions");
    expect(def).toContain("{}");
  });

  it("does NOT create a token usage table (customer brings own AI key)", async () => {
    const exists = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select 1 from information_schema.tables
         where table_schema='public' and table_name in ('token_usage','usage_statements')`,
      );
      return rows.length > 0;
    });
    expect(exists).toBe(false);
  });
});
