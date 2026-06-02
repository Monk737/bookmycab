import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseLike } from "@/lib/dashboard/queries";

export interface TicketRow {
  id: string;
  tenantId: string;
  automationId: string | null;
  createdBy: string | null;
  subject: string;
  category: string | null;
  description: string | null;
  status: string;
  createdAt: string;
}

export async function listTickets(tenantId: string, client?: SupabaseLike): Promise<TicketRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("support_tickets")
    .select("id, tenant_id, automation_id, created_by, subject, category, description, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    automationId: (r.automation_id as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    subject: r.subject as string,
    category: (r.category as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    status: (r.status as string) ?? "open",
    createdAt: r.created_at as string,
  }));
}

export interface CreateTicketArgs {
  tenantId: string;
  automationId?: string | null;
  createdBy?: string | null;
  subject: string;
  category?: string | null;
  description?: string | null;
}

export async function createTicket(
  args: CreateTicketArgs,
  client?: SupabaseLike,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      tenant_id: args.tenantId,
      automation_id: args.automationId ?? null,
      created_by: args.createdBy ?? null,
      subject: args.subject,
      category: args.category ?? null,
      description: args.description ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false };
  return { ok: true, id: (data as Record<string, unknown>).id as string };
}
