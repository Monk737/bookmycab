import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

/* ----------------------------------------------------------------- aggregates */

export interface ChatBriefingMetrics {
  weekStart: string;
  weekEnd: string;
  totalConversations: number;
  prevTotalConversations: number;
  bookedPct: number;
  prevBookedPct: number;
  bookings: number;
  quoted: number;
  cancelled: number;
  modified: number;
  failed: number;
  unresolved: number;
  voiceNotePct: number;
  /** Busiest weekday + hour (UK time). */
  busiest: { label: string; count: number } | null;
  /** Most common pickup → destination among the week's bookings. */
  topRoute: { label: string; count: number } | null;
  revenueGbp: number;
  avgFareGbp: number;
}

export interface ChatBriefing {
  headline: string;
  narrative: string;
  recommendation: string | null;
  metrics: ChatBriefingMetrics;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  model: string | null;
}

type ConvRow = { started_at: string; outcome: string | null; via_voice: boolean | null };
type BookRow = {
  created_at: string;
  status: string | null;
  fare: number | string | null;
  pickup_address: unknown;
  destination_address: unknown;
};

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => {
  const ap = h < 12 ? "am" : "pm";
  const a = h % 12 === 0 ? 12 : h % 12;
  const b = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
  return `${a}–${b}${ap}`;
};

function londonCell(iso: string): { wd: number; hr: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", hour: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hr = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { wd: Math.max(0, WD.indexOf(wdName)), hr };
}

function addr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v || null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const s = o.text ?? o.formatted ?? o.address ?? o.name;
    return typeof s === "string" && s.trim() ? s : null;
  }
  return null;
}

function bookedPct(rows: ConvRow[]): number {
  if (rows.length === 0) return 0;
  return Math.round((rows.filter((r) => r.outcome === "booked").length / rows.length) * 100);
}

/** Reduce a week's conversation + booking rows into the briefing metrics. */
function reduce(
  week: ConvRow[],
  prev: ConvRow[],
  bookings: BookRow[],
  weekStart: string,
  weekEnd: string,
): ChatBriefingMetrics {
  // Busiest weekday+hour (UK) from conversation starts.
  const cells = new Map<string, number>();
  for (const r of week) {
    const { wd, hr } = londonCell(r.started_at);
    const k = `${wd}-${hr}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  let busiest: ChatBriefingMetrics["busiest"] = null;
  for (const [k, count] of cells) {
    if (!busiest || count > busiest.count) {
      const [wd, hr] = k.split("-").map(Number);
      busiest = { label: `${WD[wd]} ${hourLabel(hr)}`, count };
    }
  }

  // Top route + revenue from the week's bookings (exclude cancelled).
  const live = bookings.filter((b) => b.status !== "cancelled");
  const routes = new Map<string, number>();
  let revenue = 0;
  let fareN = 0;
  for (const b of live) {
    const p = addr(b.pickup_address);
    const d = addr(b.destination_address);
    if (p && d) {
      const key = `${p} → ${d}`;
      routes.set(key, (routes.get(key) ?? 0) + 1);
    }
    const f = typeof b.fare === "number" ? b.fare : Number(b.fare);
    if (Number.isFinite(f) && f > 0) {
      revenue += f;
      fareN += 1;
    }
  }
  let topRoute: ChatBriefingMetrics["topRoute"] = null;
  for (const [label, count] of routes) {
    if (!topRoute || count > topRoute.count) topRoute = { label, count };
  }

  const voiceNotes = week.filter((r) => r.via_voice).length;

  return {
    weekStart,
    weekEnd,
    totalConversations: week.length,
    prevTotalConversations: prev.length,
    bookedPct: bookedPct(week),
    prevBookedPct: bookedPct(prev),
    bookings: week.filter((r) => r.outcome === "booked").length,
    quoted: week.filter((r) => r.outcome === "quoted").length,
    cancelled: week.filter((r) => r.outcome === "cancelled").length,
    modified: week.filter((r) => r.outcome === "managed").length,
    failed: week.filter((r) => r.outcome === "failed").length,
    unresolved: week.filter((r) => r.outcome === "unknown" || r.outcome === "abandoned").length,
    voiceNotePct: week.length ? Math.round((voiceNotes / week.length) * 100) : 0,
    busiest,
    topRoute,
    revenueGbp: Math.round(revenue),
    avgFareGbp: fareN ? Math.round((revenue / fareN) * 100) / 100 : 0,
  };
}

/* -------------------------------------------------------------- generation */

const OUTPUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: "One short line summarising the WhatsApp chatbot week. No trailing period." },
    narrative: { type: Type.STRING, description: "2 to 4 plain sentences over the figures: conversation volume, booked rate vs last week, busiest window, top route, and anything that cost bookings (cancellations, failed bookings, unresolved chats)." },
    recommendation: { type: Type.STRING, description: "One concrete, specific action for the operator this week, tied to the data." },
  },
  required: ["headline", "narrative", "recommendation"],
  propertyOrdering: ["headline", "narrative", "recommendation"],
};

const SYSTEM = [
  "You are the operations analyst for a UK private-hire (taxi) firm, writing the weekly briefing for the firm's owner about their WhatsApp booking chatbot (text and voice notes).",
  "Write plain, specific British English. Name what happened with the actual figures. No buzzwords, no hype, no em dashes.",
  "Only state facts present in the data given. Do not invent numbers. If a figure is zero or absent, say so or omit it.",
  "This is a WhatsApp chat assistant, not a phone line: there are no call durations or hold times. Talk about conversations, bookings, quotes, cancellations, voice notes and routes.",
  "The recommendation must be one concrete action tied to the data (for example: a high share of quotes that never booked suggests the quote-to-confirm step needs a nudge).",
].join(" ");

/** Generate + persist the chat briefing for one tenant. Best-effort; never throws. */
export async function generateChatBriefingForTenant(
  tenantId: string,
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (!env.GEMINI_API_KEY) return { ok: false, skipped: "no_api_key" };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const weekEnd = now.toISOString();
  const weekStartMs = now.getTime() - 7 * 86_400_000;
  const weekStart = new Date(weekStartMs).toISOString();
  const priorStart = new Date(weekStartMs - 7 * 86_400_000).toISOString();

  const [{ data: convData, error: convErr }, { data: bookData }] = await Promise.all([
    db.from("conversations").select("started_at, outcome, via_voice")
      .eq("tenant_id", tenantId).gte("started_at", priorStart).lt("started_at", weekEnd),
    db.from("bookings").select("created_at, status, fare, pickup_address, destination_address")
      .eq("tenant_id", tenantId).gte("created_at", weekStart).lt("created_at", weekEnd),
  ]);
  if (convErr) return { ok: false, error: convErr.message };

  const rows = (convData ?? []) as ConvRow[];
  const week = rows.filter((r) => r.started_at >= weekStart);
  if (week.length === 0) return { ok: false, skipped: "no_conversations" };
  const prev = rows.filter((r) => r.started_at < weekStart);
  const metrics = reduce(week, prev, (bookData ?? []) as BookRow[], weekStart.slice(0, 10), weekEnd.slice(0, 10));

  let parsed: { headline: string; narrative: string; recommendation: string };
  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const isFlash = env.BRIEFING_MODEL.includes("flash");
    const res = await ai.models.generateContent({
      model: env.BRIEFING_MODEL,
      contents: `This week's WhatsApp chatbot data (JSON). Compare booked rate and volume to last week, and call out anything that cost bookings.\n\n${JSON.stringify(metrics)}`,
      config: {
        systemInstruction: SYSTEM,
        maxOutputTokens: isFlash ? 1024 : 4096,
        ...(isFlash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        responseMimeType: "application/json",
        responseSchema: OUTPUT_SCHEMA,
      },
    });
    parsed = JSON.parse(res.text ?? "");
  } catch (e) {
    console.error("chat briefing generation failed", { tenantId, error: String((e as Error)?.message ?? e) });
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) };
  }

  const { error: upErr } = await db.from("chat_briefings").upsert(
    {
      tenant_id: tenantId,
      period_start: metrics.weekStart,
      period_end: metrics.weekEnd,
      headline: parsed.headline.slice(0, 300),
      narrative: parsed.narrative.slice(0, 4000),
      recommendation: (parsed.recommendation ?? "").slice(0, 1000) || null,
      metrics,
      model: env.BRIEFING_MODEL,
    },
    { onConflict: "tenant_id,period_start" },
  );
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}

/** Generate chat briefings for every tenant with conversations in the last week. */
export async function generateAllChatBriefings(): Promise<{ tenants: number; generated: number; skipped: number; failed: number }> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await db.from("conversations").select("tenant_id").gte("started_at", since);
  const tenantIds = [...new Set(((data ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id))];

  let generated = 0, skipped = 0, failed = 0;
  for (const id of tenantIds) {
    const r = await generateChatBriefingForTenant(id);
    if (r.ok) generated++;
    else if (r.skipped) skipped++;
    else failed++;
  }
  return { tenants: tenantIds.length, generated, skipped, failed };
}

/* ------------------------------------------------------------------- read */

type BriefingRow = {
  headline: string;
  narrative: string;
  recommendation: string | null;
  metrics: ChatBriefingMetrics;
  period_start: string;
  period_end: string;
  created_at: string;
  model: string | null;
};

const toBriefing = (data: BriefingRow): ChatBriefing => ({
  headline: data.headline,
  narrative: data.narrative,
  recommendation: data.recommendation ?? null,
  metrics: data.metrics,
  periodStart: data.period_start,
  periodEnd: data.period_end,
  createdAt: data.created_at,
  model: data.model ?? null,
});

const BRIEFING_COLS = "headline, narrative, recommendation, metrics, period_start, period_end, created_at, model";

export async function getLatestChatBriefing(tenantId: string): Promise<ChatBriefing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_briefings")
    .select(BRIEFING_COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return toBriefing(data as BriefingRow);
}

export async function getRecentChatBriefings(tenantId: string, limit = 8): Promise<ChatBriefing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_briefings")
    .select(BRIEFING_COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as BriefingRow[]).map(toBriefing);
}
