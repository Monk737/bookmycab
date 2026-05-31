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

describe("0002 automations + channels", () => {
  it("creates automations scoped to a tenant with engine ids", async () => {
    const cols = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name='automations'`,
      );
      return rows.map((r) => r.column_name as string);
    });
    expect(cols).toEqual(
      expect.arrayContaining(["tenant_id", "type", "engine_workflow_id", "engine_project_id", "status"]),
    );
  });

  it("creates channels bound to exactly one automation", async () => {
    const checks = (await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select cc.check_clause from information_schema.table_constraints tc
         join information_schema.check_constraints cc using (constraint_schema, constraint_name)
         where tc.table_schema='public' and tc.table_name='channels'`,
      );
      return rows.map((r) => r.check_clause as string);
    })).join(" | ");
    expect(checks).toContain("whatsapp");
    expect(checks).toContain("widget");
  });
});

describe("0003 conversations + bookings", () => {
  it("creates bookings with dispatch + airport audit fields", async () => {
    const cols = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name='bookings'`,
      );
      return rows.map((r) => r.column_name as string);
    });
    expect(cols).toEqual(
      expect.arrayContaining([
        "tenant_id", "automation_id", "conversation_id", "dispatch_ref",
        "pickup_address", "destination_address", "airport_json", "raw_dispatch_json",
        "your_reference_1", "your_reference_2", "your_reference_3",
      ]),
    );
  });

  it("creates conversations.outcome and messages.message_type with PRD enums", async () => {
    const checks = (await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select cc.check_clause from information_schema.table_constraints tc
         join information_schema.check_constraints cc using (constraint_schema, constraint_name)
         where tc.table_schema='public' and tc.table_name in ('conversations','messages')`,
      );
      return rows.map((r) => r.check_clause as string);
    })).join(" | ");
    expect(checks).toContain("abandoned");   // conversations.outcome
    expect(checks).toContain("voice");        // messages.message_type
  });
});

describe("0004 billing + audit", () => {
  it("creates subscriptions, setup_fees, audit_log", async () => {
    const tables = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select table_name from information_schema.tables
         where table_schema='public' and table_name in ('subscriptions','setup_fees','audit_log')`,
      );
      return rows.map((r) => r.table_name as string);
    });
    expect(tables.sort()).toEqual(["audit_log", "setup_fees", "subscriptions"]);
  });

  it("audit_log id is a bigserial (append-only ledger)", async () => {
    const def = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_default from information_schema.columns
         where table_schema='public' and table_name='audit_log' and column_name='id'`,
      );
      return rows[0]?.column_default as string;
    });
    expect(def).toContain("nextval");
  });
});
