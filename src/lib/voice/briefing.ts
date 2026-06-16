import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

/* ----------------------------------------------------------------- aggregates */

export interface BriefingMetrics {
  weekStart: string;
  weekEnd: string;
  totalCalls: number;
  prevTotalCalls: number;
  bookedPct: number;
  prevBookedPct: number;
  failed: number;
  cancelled: number;
  abandoned: number;
  avgHandleS: number;
  /** Busiest weekday + hour (UK time), e.g. "Mon 8–9am". */
  busiest: { label: string; count: number } | null;
  /** Calls with 4+ address look-ups that never booked. */
  addressConfusionLost: number;
  /** Hours with a cluster of failures, e.g. "14 Jun 22:00 · 4 failed". */
  failureClusters: { when: string; count: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface Briefing {
  headline: string;
  narrative: string;
  recommendation: string | null;
  metrics: BriefingMetrics;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  model: string | null;
}

type CallRow = {
  started_at: string;
  outcome: string;
  duration_s: number | null;
  success: boolean | null;
  sentiment: string | null;
  address_lookups: number | null;
};

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => {
  const ap = h < 12 ? "am" : "pm";
  const a = h % 12 === 0 ? 12 : h % 12;
  const b = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
  return `${a}–${b}${ap}`;
};

/** UK-local weekday index + hour for an instant. */
function londonCell(iso: string): { wd: number; hr: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "short", hour: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hr = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { wd: Math.max(0, WD.indexOf(wdName)), hr };
}

function bookedPct(rows: CallRow[]): number {
  if (rows.length === 0) return 0;
  return Math.round((rows.filter((r) => r.outcome === "booked").length / rows.length) * 100);
}

/** Reduce a window's call rows into the briefing metrics (deterministic). */
function reduce(week: CallRow[], prev: CallRow[], weekStart: string, weekEnd: string): BriefingMetrics {
  const durs = week.filter((r) => typeof r.duration_s === "number");
  const avgHandleS = durs.length ? Math.round(durs.reduce((s, r) => s + (r.duration_s ?? 0), 0) / durs.length) : 0;

  // Busiest weekday+hour (UK time).
  const cells = new Map<string, number>();
  for (const r of week) {
    const { wd, hr } = londonCell(r.started_at);
    const k = `${wd}-${hr}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  let busiest: BriefingMetrics["busiest"] = null;
  for (const [k, count] of cells) {
    if (!busiest || count > busiest.count) {
      const [wd, hr] = k.split("-").map(Number);
      busiest = { label: `${WD[wd]} ${hourLabel(hr)}`, count };
    }
  }

  // Failure clusters by UTC hour bucket.
  const fbuckets = new Map<string, number>();
  for (const r of week) {
    if (r.outcome !== "failed") continue;
    const k = r.started_at.slice(0, 13);
    fbuckets.set(k, (fbuckets.get(k) ?? 0) + 1);
  }
  const failureClusters = [...fbuckets.entries()]
    .filter(([, n]) => n >= 3)
    .map(([k, count]) => ({
      when: new Date(`${k}:00:00Z`).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const r of week) if (r.sentiment === "positive" || r.sentiment === "neutral" || r.sentiment === "negative") sentiment[r.sentiment]++;

  return {
    weekStart,
    weekEnd,
    totalCalls: week.length,
    prevTotalCalls: prev.length,
    bookedPct: bookedPct(week),
    prevBookedPct: bookedPct(prev),
    failed: week.filter((r) => r.outcome === "failed").length,
    cancelled: week.filter((r) => r.outcome === "cancelled").length,
    abandoned: week.filter((r) => r.outcome === "abandoned").length,
    avgHandleS,
    busiest,
    addressConfusionLost: week.filter((r) => (r.address_lookups ?? 0) >= 4 && r.outcome !== "booked").length,
    failureClusters,
    sentiment,
  };
}

/* -------------------------------------------------------------- generation */

const OUTPUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: "One short line summarising the week. No trailing period." },
    narrative: { type: Type.STRING, description: "2 to 4 plain sentences over the figures: volume, booked rate vs last week, busiest window, and anything that lost bookings (address confusion, failures)." },
    recommendation: { type: Type.STRING, description: "One concrete, specific action for the operator this week." },
  },
  required: ["headline", "narrative", "recommendation"],
  propertyOrdering: ["headline", "narrative", "recommendation"],
};

const SYSTEM = [
  "You are the operations analyst for a UK private-hire (taxi) firm, writing the weekly briefing for the firm's owner about their AI phone agent.",
  "Write plain, specific British English. Name what happened with the actual figures. No buzzwords, no hype, no em dashes.",
  "Only state facts present in the data given. Do not invent numbers. If a figure is zero or absent, say so or omit it.",
  "The recommendation must be one concrete action tied to the data (for example: callers lost to repeated address confusion suggests tightening the address-confirmation prompt).",
].join(" ");

/** Generate + persist the briefing for one tenant. Best-effort; never throws. */
export async function generateBriefingForTenant(tenantId: string): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (!env.GEMINI_API_KEY) return { ok: false, skipped: "no_api_key" };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const weekEnd = now.toISOString();
  const weekStartMs = now.getTime() - 7 * 86_400_000;
  const weekStart = new Date(weekStartMs).toISOString();
  const priorStart = new Date(weekStartMs - 7 * 86_400_000).toISOString();

  const { data, error } = await db
    .from("calls")
    .select("started_at, outcome, duration_s, success, sentiment, address_lookups")
    .eq("tenant_id", tenantId)
    .gte("started_at", priorStart)
    .lt("started_at", weekEnd);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as CallRow[];
  const week = rows.filter((r) => r.started_at >= weekStart);
  if (week.length === 0) return { ok: false, skipped: "no_calls" };
  const prev = rows.filter((r) => r.started_at < weekStart);
  const metrics = reduce(week, prev, weekStart.slice(0, 10), weekEnd.slice(0, 10));

  let parsed: { headline: string; narrative: string; recommendation: string };
  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    // Flash / Flash-Lite can skip thinking for a fast, deterministic JSON; Pro
    // always thinks, so leave its budget to the model and give output headroom.
    const isFlash = env.BRIEFING_MODEL.includes("flash");
    const res = await ai.models.generateContent({
      model: env.BRIEFING_MODEL,
      contents: `This week's AI voice-agent data (JSON). Compare booked rate and volume to last week, and call out anything that cost bookings.\n\n${JSON.stringify(metrics)}`,
      config: {
        systemInstruction: SYSTEM,
        // Pro keeps its thinking on (needs output headroom); Flash thinks off.
        maxOutputTokens: isFlash ? 1024 : 4096,
        ...(isFlash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        // Structured output: a JSON object matching OUTPUT_SCHEMA.
        responseMimeType: "application/json",
        responseSchema: OUTPUT_SCHEMA,
      },
    });
    parsed = JSON.parse(res.text ?? "");
  } catch (e) {
    console.error("briefing generation failed", { tenantId, error: String((e as Error)?.message ?? e) });
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) };
  }

  const { error: upErr } = await db.from("voice_briefings").upsert(
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

/** Generate briefings for every tenant with voice calls in the last week. */
export async function generateAllBriefings(): Promise<{ tenants: number; generated: number; skipped: number; failed: number }> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await db.from("calls").select("tenant_id").gte("started_at", since);
  const tenantIds = [...new Set(((data ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id))];

  let generated = 0, skipped = 0, failed = 0;
  for (const id of tenantIds) {
    const r = await generateBriefingForTenant(id);
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
  metrics: BriefingMetrics;
  period_start: string;
  period_end: string;
  created_at: string;
  model: string | null;
};

const toBriefing = (data: BriefingRow): Briefing => ({
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

/** The most recent briefing for a tenant (RLS-scoped for dashboard display). */
export async function getLatestBriefing(tenantId: string): Promise<Briefing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_briefings")
    .select(BRIEFING_COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return toBriefing(data as BriefingRow);
}

/** Recent briefings for a tenant, newest first — powers the dedicated briefing page archive. */
export async function getRecentBriefings(tenantId: string, limit = 8): Promise<Briefing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_briefings")
    .select(BRIEFING_COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as BriefingRow[]).map(toBriefing);
}
