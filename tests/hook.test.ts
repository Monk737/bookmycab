import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres, withSuperuser } from "./helpers/db";

const TENANT = "33333333-3333-3333-3333-333333333333";
const STAFF = "dddddddd-dddd-dddd-dddd-dddddddddddd";   // @flowmoai.com
const TENANT_USER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const AUTO = "f1111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query(
      `insert into public.tenants (id, name, slug, country, plan_band, currency)
       values ($1, 'Hook Co', 'hook-co', 'GB', 'A-Single', 'GBP') on conflict do nothing`,
      [TENANT],
    );
    for (const [id, email] of [
      [STAFF, "ops@flowmoai.com"],
      [TENANT_USER, "raj@hook-co.com"],
    ] as const) {
      await c.query(
        `insert into auth.users (instance_id, id, aud, role, email)
         values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2)
         on conflict (id) do nothing`,
        [id, email],
      );
      await c.query(`insert into public.users (id, email) values ($1, $2) on conflict do nothing`, [id, email]);
    }
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role, automation_restrictions)
       values ($1, $2, 'Admin', $3::uuid[]) on conflict do nothing`,
      [TENANT, TENANT_USER, `{${AUTO}}`],
    );
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.tenant_users where tenant_id = $1", [TENANT]);
    await c.query("delete from public.tenants where id = $1", [TENANT]);
    await c.query("delete from public.users where id in ($1,$2)", [STAFF, TENANT_USER]);
    await c.query("delete from auth.users where id in ($1,$2)", [STAFF, TENANT_USER]);
  });
});

function callHook(userId: string, email: string) {
  return withPostgres(async (c) => {
    const event = { user_id: userId, claims: { sub: userId, email } };
    const { rows } = await c.query("select public.custom_access_token_hook($1::jsonb) as out", [
      JSON.stringify(event),
    ]);
    return (rows[0].out as { claims: Record<string, unknown> }).claims;
  });
}

// Executes the hook under the REAL production role (supabase_auth_admin),
// which is subject to RLS on tenant_users — proves the auth-admin read policy works.
function callHookAsAuthAdmin(userId: string, email: string) {
  return withSuperuser(async (c) => {
    await c.query("begin");
    await c.query("set local role supabase_auth_admin");
    const event = { user_id: userId, claims: { sub: userId, email } };
    const { rows } = await c.query("select public.custom_access_token_hook($1::jsonb) as out", [
      JSON.stringify(event),
    ]);
    await c.query("rollback");
    return (rows[0].out as { claims: Record<string, unknown> }).claims;
  });
}

describe("custom_access_token_hook", () => {
  it("injects tenant_id, user_role, automation_restrictions for a tenant user", async () => {
    const claims = await callHook(TENANT_USER, "raj@hook-co.com");
    expect(claims.tenant_id).toBe(TENANT);
    // App role lives under user_role; the reserved `role` claim is left for
    // PostgREST (must stay `authenticated`), never overwritten with the app role.
    expect(claims.user_role).toBe("Admin");
    expect(claims.role).not.toBe("Admin");
    expect(claims.automation_restrictions).toEqual([AUTO]);
    expect(claims.is_flowmo_staff).toBe(false);
  });

  it("flags is_flowmo_staff for a @flowmoai.com email", async () => {
    const claims = await callHook(STAFF, "ops@flowmoai.com");
    expect(claims.is_flowmo_staff).toBe(true);
  });

  it("works under the supabase_auth_admin role (RLS-respecting production path)", async () => {
    const claims = await callHookAsAuthAdmin(TENANT_USER, "raj@hook-co.com");
    expect(claims.tenant_id).toBe(TENANT);
    expect(claims.user_role).toBe("Admin");
    expect(claims.automation_restrictions).toEqual([AUTO]);
  });
});
