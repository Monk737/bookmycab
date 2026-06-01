import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves a set of assigned_engineer user UUIDs to their emails in a single
 * batched query (never N+1). Takes the service-role client because public.users
 * is not tenant-readable. Ids that have no email (or no matching row) are simply
 * absent from the returned map.
 */
export async function resolveEngineerEmails(
  serviceClient: SupabaseClient,
  ids: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(
    new Set(ids.filter((v): v is string => !!v)),
  );

  const emailByUser = new Map<string, string>();
  if (uniqueIds.length === 0) return emailByUser;

  const { data: users } = await serviceClient
    .from("users")
    .select("id, email")
    .in("id", uniqueIds);

  for (const u of (users ?? []) as Array<{ id: string; email: string | null }>) {
    if (u.email) emailByUser.set(u.id, u.email);
  }

  return emailByUser;
}
