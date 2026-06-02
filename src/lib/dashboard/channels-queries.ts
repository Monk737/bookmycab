import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseLike } from "@/lib/dashboard/queries";
import { channelHealth } from "@/lib/dashboard/queries";

export interface ChannelRow {
  id: string;
  type: string;
  externalId: string | null;
  status: string;
  health: "healthy" | "warning" | "disconnected";
  tokenExpiresAt: string | null;
  tokenExpiresInDays: number | null;
  lastMessageAt: string | null;
}

export async function getChannels(automationId: string, client?: SupabaseLike): Promise<ChannelRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("channels")
    .select("id, type, external_id, status, token_expires_at, last_message_at")
    .eq("automation_id", automationId)
    .order("type");

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const tokenExpiresAt = (r.token_expires_at as string | null) ?? null;
    return {
      id: r.id as string,
      type: r.type as string,
      externalId: (r.external_id as string | null) ?? null,
      status: r.status as string,
      health: channelHealth(r.status as string, tokenExpiresAt),
      tokenExpiresAt,
      tokenExpiresInDays: tokenExpiresAt
        ? Math.ceil((new Date(tokenExpiresAt).getTime() - Date.now()) / 86_400_000)
        : null,
      lastMessageAt: (r.last_message_at as string | null) ?? null,
    };
  });
}
