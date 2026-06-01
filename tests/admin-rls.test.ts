import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres, asUser } from "./helpers/db";

// Deterministic fixtures (kept distinct from rls.test.ts ids).
const TENANT = "44444444-4444-4444-4444-444444444444";
const USER = "44444444-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Owner of TENANT
const ENGINEER = "44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // assigned_engineer FK target
const AUTO = "44a11111-1111-1111-1111-111111111111";
const CHANNEL = "44c11111-1111-1111-1111-111111111111";

const VAULT_KEY = "test-vault-key-do-not-use-in-prod";
const RAW_SECRET = "whatsapp-token-SUPER-secret-12345";

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query("begin");
    for (const [id, email] of [
      [USER, "owner@vault-co.com"],
      [ENGINEER, "eng@flowmoai.com"],
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
    await c.query(
      `insert into public.tenants (id, name, slug, country, plan_band, currency)
       values ($1, 'Vault Co', 'vault-co', 'GB', 'A-Single', 'GBP') on conflict (id) do nothing`,
      [TENANT],
    );
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role)
       values ($1, $2, 'Owner') on conflict do nothing`,
      [TENANT, USER],
    );
    await c.query(
      `insert into public.automations (id, tenant_id, name, type)
       values ($1, $2, 'Vault Bot', 'Booking') on conflict (id) do nothing`,
      [AUTO, TENANT],
    );
    await c.query(
      `insert into public.channels (id, tenant_id, automation_id, type, webhook_path)
       values ($1, $2, $3, 'whatsapp', '/webhooks/whatsapp/x') on conflict (id) do nothing`,
      [CHANNEL, TENANT, AUTO],
    );
    await c.query("commit");
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.channel_credentials where tenant_id = $1", [TENANT]);
    await c.query("delete from public.channels where tenant_id = $1", [TENANT]);
    await c.query("delete from public.automations where tenant_id = $1", [TENANT]);
    await c.query("delete from public.tenant_users where tenant_id = $1", [TENANT]);
    await c.query("delete from public.tenants where id = $1", [TENANT]);
    await c.query("delete from public.users where id in ($1,$2)", [USER, ENGINEER]);
    await c.query("delete from auth.users where id in ($1,$2)", [USER, ENGINEER]);
  });
});

describe("0007 build-queue fields", () => {
  it("automations has build_stage with default 'Requested' and the CHECK constraint", async () => {
    await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select build_stage from public.automations where id = $1`,
        [AUTO],
      );
      expect(rows[0].build_stage).toBe("Requested");

      // CHECK rejects an out-of-set value.
      await expect(
        c.query(`update public.automations set build_stage = 'Nope' where id = $1`, [AUTO]),
      ).rejects.toThrow();

      // and accepts a valid one.
      const { rows: ok } = await c.query(
        `update public.automations set build_stage = 'Building' where id = $1 returning build_stage`,
        [AUTO],
      );
      expect(ok[0].build_stage).toBe("Building");
      await c.query(`update public.automations set build_stage = 'Requested' where id = $1`, [AUTO]);
    });
  });

  it("has assigned_engineer (uuid FK -> users), target_go_live (date), build_notes (text)", async () => {
    await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_name, data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'automations'
           and column_name in ('assigned_engineer','target_go_live','build_notes')
         order by column_name`,
      );
      const byName = Object.fromEntries(rows.map((r) => [r.column_name, r.data_type]));
      expect(byName.assigned_engineer).toBe("uuid");
      expect(byName.target_go_live).toBe("date");
      expect(byName.build_notes).toBe("text");

      // FK enforced: bogus engineer id rejected, real users.id accepted.
      await expect(
        c.query(`update public.automations set assigned_engineer = gen_random_uuid() where id = $1`, [AUTO]),
      ).rejects.toThrow();
      const { rows: ok } = await c.query(
        `update public.automations
           set assigned_engineer = $2, target_go_live = '2026-07-01', build_notes = 'kickoff'
         where id = $1 returning assigned_engineer, target_go_live, build_notes`,
        [AUTO, ENGINEER],
      );
      expect(ok[0].assigned_engineer).toBe(ENGINEER);
      expect(ok[0].build_notes).toBe("kickoff");
      await c.query(
        `update public.automations
           set assigned_engineer = null, target_go_live = null, build_notes = null
         where id = $1`,
        [AUTO],
      );
    });
  });
});

describe("0008 credentials vault", () => {
  it("stored secret is NOT readable as plaintext; round-trips through vault_read_credential", async () => {
    let credId: string;
    // Store + read happen on one connection so the session GUC `app.vault_key` is set.
    await withPostgres(async (c) => {
      await c.query("select set_config('app.vault_key', $1, false)", [VAULT_KEY]);
      const { rows } = await c.query(
        `select public.vault_store_credential($1,$2,$3,$4,$5) as id`,
        [TENANT, CHANNEL, "whatsapp_token", RAW_SECRET, USER],
      );
      credId = rows[0].id as string;
      expect(credId).toMatch(/^[0-9a-f-]{36}$/);

      // Stored column is encrypted bytea: the raw secret must NOT be present.
      const { rows: stored } = await c.query(
        `select secret_encrypted, encode(secret_encrypted, 'escape') as as_text
         from public.channel_credentials where id = $1`,
        [credId],
      );
      expect(Buffer.isBuffer(stored[0].secret_encrypted)).toBe(true);
      expect(stored[0].as_text).not.toContain(RAW_SECRET);
      expect(stored[0].secret_encrypted.toString("utf8")).not.toContain(RAW_SECRET);

      // Round-trip decrypt returns the original plaintext + records access.
      const { rows: read } = await c.query(
        `select public.vault_read_credential($1,$2) as secret`,
        [credId, USER],
      );
      expect(read[0].secret).toBe(RAW_SECRET);

      const { rows: meta } = await c.query(
        `select last_accessed_by, last_accessed_at from public.channel_credentials where id = $1`,
        [credId],
      );
      expect(meta[0].last_accessed_by).toBe(USER);
      expect(meta[0].last_accessed_at).not.toBeNull();
    });
  });

  it("tenant users (authenticated) cannot read channel_credentials (hard-deny)", async () => {
    await asUser(USER, async (q) => {
      await expect(q("select * from public.channel_credentials")).rejects.toThrow();
    });
  });
});

describe("audit_log append-only guarantee still holds", () => {
  it("tenant users cannot read the audit_log", async () => {
    await asUser(USER, async (q) => {
      await expect(q("select * from public.audit_log")).rejects.toThrow();
    });
  });
});
