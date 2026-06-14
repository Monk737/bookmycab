import "server-only";
import { createClient } from "@/lib/supabase/server";
import { channelHealth } from "./queries";

export interface AutomationChannel {
  type: string;
  health: "healthy" | "warning" | "disconnected";
  handle: string | null;
}

export interface AutomationCardData {
  id: string;
  name: string;
  type: string; // "Voice" | "Chat"
  isVoice: boolean;
  status: string;
  buildStage: string | null;
  phone: string | null;
  channels: AutomationChannel[];
  /** Work performed in the window (voice agents). */
  voice?: { calls: number; booked: number; quoted: number; bookedPct: number; avgDurationS: number };
  /** Work performed in the window (chat automations). */
  chat?: { conversations: number; booked: number; bookedPct: number; bookings: number };
}

type Row = Record<string, unknown>;

/**
 * Every automation deployed for a tenant (Chat + Voice), each with the work it
 * performed over the last `sinceDays`. RLS-scoped via the server client. Voice
 * work comes from `calls`, chat work from `conversations` + `bookings`.
 */
export async function getTenantAutomations(
  tenantId: string,
  sinceDays = 30,
): Promise<AutomationCardData[]> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

  const [autos, agents, channels, calls, convos, bookings] = await Promise.all([
    supabase.from("automations").select("id, name, type, status, build_stage").eq("tenant_id", tenantId).order("created_at", { ascending: true }),
    supabase.from("voice_agents").select("automation_id, phone_number").eq("tenant_id", tenantId),
    supabase.from("channels").select("automation_id, type, status, token_expires_at, external_id").eq("tenant_id", tenantId),
    supabase.from("calls").select("automation_id, outcome, duration_s").eq("tenant_id", tenantId).gte("started_at", sinceIso),
    supabase.from("conversations").select("automation_id, outcome").eq("tenant_id", tenantId).gte("started_at", sinceIso),
    supabase.from("bookings").select("automation_id").eq("tenant_id", tenantId).gte("created_at", sinceIso),
  ]);

  const phoneByAuto = new Map<string, string>();
  for (const a of (agents.data ?? []) as Row[]) {
    if (a.phone_number) phoneByAuto.set(a.automation_id as string, a.phone_number as string);
  }

  const channelsByAuto = new Map<string, AutomationChannel[]>();
  for (const c of (channels.data ?? []) as Row[]) {
    const id = c.automation_id as string;
    const list = channelsByAuto.get(id) ?? [];
    list.push({
      type: c.type as string,
      health: channelHealth(c.status as string, (c.token_expires_at as string) ?? null),
      handle: (c.external_id as string) ?? null,
    });
    channelsByAuto.set(id, list);
  }

  const voiceByAuto = new Map<string, { calls: number; booked: number; quoted: number; durSum: number; durN: number }>();
  for (const c of (calls.data ?? []) as Row[]) {
    const id = c.automation_id as string;
    const v = voiceByAuto.get(id) ?? { calls: 0, booked: 0, quoted: 0, durSum: 0, durN: 0 };
    v.calls += 1;
    if (c.outcome === "booked") v.booked += 1;
    if (c.outcome === "quoted") v.quoted += 1;
    if (typeof c.duration_s === "number") { v.durSum += c.duration_s; v.durN += 1; }
    voiceByAuto.set(id, v);
  }

  const chatByAuto = new Map<string, { conversations: number; booked: number }>();
  for (const c of (convos.data ?? []) as Row[]) {
    const id = c.automation_id as string;
    const v = chatByAuto.get(id) ?? { conversations: 0, booked: 0 };
    v.conversations += 1;
    if (c.outcome === "booked") v.booked += 1;
    chatByAuto.set(id, v);
  }

  const bookingsByAuto = new Map<string, number>();
  for (const b of (bookings.data ?? []) as Row[]) {
    const id = b.automation_id as string;
    bookingsByAuto.set(id, (bookingsByAuto.get(id) ?? 0) + 1);
  }

  return ((autos.data ?? []) as Row[]).map((a) => {
    const id = a.id as string;
    const isVoice = String(a.type).toLowerCase() === "voice";
    const card: AutomationCardData = {
      id,
      name: (a.name as string) ?? "Automation",
      type: a.type as string,
      isVoice,
      status: (a.status as string) ?? "building",
      buildStage: (a.build_stage as string) ?? null,
      phone: phoneByAuto.get(id) ?? null,
      channels: channelsByAuto.get(id) ?? [],
    };
    if (isVoice) {
      const v = voiceByAuto.get(id) ?? { calls: 0, booked: 0, quoted: 0, durSum: 0, durN: 0 };
      card.voice = {
        calls: v.calls,
        booked: v.booked,
        quoted: v.quoted,
        bookedPct: v.calls > 0 ? Math.round((v.booked / v.calls) * 100) : 0,
        avgDurationS: v.durN > 0 ? Math.round(v.durSum / v.durN) : 0,
      };
    } else {
      const v = chatByAuto.get(id) ?? { conversations: 0, booked: 0 };
      card.chat = {
        conversations: v.conversations,
        booked: v.booked,
        bookedPct: v.conversations > 0 ? Math.round((v.booked / v.conversations) * 100) : 0,
        bookings: bookingsByAuto.get(id) ?? 0,
      };
    }
    return card;
  });
}
