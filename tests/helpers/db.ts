import { Client } from "pg";

export const DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Connect as the superuser `postgres` role (bypasses RLS). */
export async function withPostgres<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/**
 * Run `fn` inside a transaction impersonating an authenticated user.
 * Sets request.jwt.claims (so auth.uid() works) then switches to the
 * `authenticated` role so RLS applies. Always rolls back.
 */
export async function asUser(
  userId: string,
  fn: (q: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>) => Promise<void>,
): Promise<void> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await c.query("SET LOCAL role authenticated");
    const q = async (sql: string, params?: unknown[]) =>
      (await c.query(sql, params)).rows as Record<string, unknown>[];
    await fn(q);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    await c.end();
  }
}
