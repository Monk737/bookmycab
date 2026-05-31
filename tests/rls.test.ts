import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres, asUser } from "./helpers/db";

// Deterministic fixtures across two tenants.
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // member of tenant A (Owner)
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // member of tenant B (Owner)
const USER_V = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // tenant A Viewer restricted to AUTO_A1
const AUTO_A1 = "a1111111-1111-1111-1111-111111111111";
const AUTO_A2 = "a2222222-2222-2222-2222-222222222222";
const AUTO_B1 = "b1111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query("begin");
    // auth.users rows so public.users FK is satisfiable
    for (const [id, email] of [
      [USER_A, "owner-a@acme-cabs.com"],
      [USER_B, "owner-b@other-cabs.com"],
      [USER_V, "viewer-a@acme-cabs.com"],
    ] as const) {
      await c.query(
        `insert into auth.users (instance_id, id, aud, role, email)
         values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2)
         on conflict (id) do nothing`,
        [id, email],
      );
      await c.query(
        `insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing`,
        [id, email],
      );
    }
    for (const [id, name, slug] of [
      [TENANT_A, "Acme Cabs", "acme-cabs"],
      [TENANT_B, "Other Cabs", "other-cabs"],
    ] as const) {
      await c.query(
        `insert into public.tenants (id, name, slug, country, plan_band, currency)
         values ($1, $2, $3, 'GB', 'A-Single', 'GBP') on conflict (id) do nothing`,
        [id, name, slug],
      );
    }
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role) values
        ($1,$2,'Owner'), ($3,$4,'Owner') on conflict do nothing`,
      [TENANT_A, USER_A, TENANT_B, USER_B],
    );
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role, automation_restrictions)
       values ($1, $2, 'Viewer', $3::uuid[]) on conflict do nothing`,
      [TENANT_A, USER_V, `{${AUTO_A1}}`],
    );
    for (const [id, tenant, name] of [
      [AUTO_A1, TENANT_A, "WA Booking Bot"],
      [AUTO_A2, TENANT_A, "Telegram Support"],
      [AUTO_B1, TENANT_B, "WA Booking Bot"],
    ] as const) {
      await c.query(
        `insert into public.automations (id, tenant_id, name, type)
         values ($1, $2, $3, 'Booking') on conflict (id) do nothing`,
        [id, tenant, name],
      );
    }
    await c.query("commit");
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.automations where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenant_users where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenants where id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.users where id in ($1,$2,$3)", [USER_A, USER_B, USER_V]);
    await c.query("delete from auth.users where id in ($1,$2,$3)", [USER_A, USER_B, USER_V]);
  });
});

describe("RLS tenant isolation", () => {
  it("owner of tenant A sees only tenant A automations", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select id from public.automations order by name");
      const ids = rows.map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([AUTO_A1, AUTO_A2]));
      expect(ids).not.toContain(AUTO_B1);
    });
  });

  it("owner of tenant B cannot see tenant A automations", async () => {
    await asUser(USER_B, async (q) => {
      const rows = await q("select id from public.automations");
      expect(rows.map((r) => r.id)).toEqual([AUTO_B1]);
    });
  });

  it("restricted Viewer sees only the allowed automation", async () => {
    await asUser(USER_V, async (q) => {
      const rows = await q("select id from public.automations");
      expect(rows.map((r) => r.id)).toEqual([AUTO_A1]);
    });
  });

  it("a tenant user cannot insert an automation for another tenant", async () => {
    await asUser(USER_A, async (q) => {
      await expect(
        q(
          `insert into public.automations (tenant_id, name, type)
           values ($1, 'Sneaky', 'Booking')`,
          [TENANT_B],
        ),
      ).rejects.toThrow();
    });
  });

  it("tenant users cannot read the audit_log", async () => {
    await asUser(USER_A, async (q) => {
      await expect(q("select * from public.audit_log")).rejects.toThrow();
    });
  });
});
