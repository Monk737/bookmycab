# Epic 10 — Voice Pipeline Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two unmet Epic 10 deliverables — the dashboard **Voice Note Stats** analytics section and **Whisper language auto-detect** — so the voice pipeline is fully observable end-to-end.

**Architecture:** The voice booking pipeline already exists in the version-controlled n8n artifacts: `WA Voice Booking Processor.json` (Whisper transcribe → GPT slot extraction → normalize) is wired into `Premier-Cab-Main-Workflow.json` at the intent router (`Detect_Audio → IF_Voice → Execute_Voice → Apply_Voice_Slots → Inject_Transcript`), and the dashboard transcript view (`conversations-client.tsx`) already renders the voice branch (transcript + extracted slots + intent badge). This plan adds: (A) a real `getVoiceStats` analytics metric + UI section that reads the `messages`/`conversations` tables, replacing the section-10 stub; and (B) language auto-detect in the voice sub-workflow so the detected language is emitted on the normalized output (`_voice.language`) for the conversation-write contract, replacing the hardcoded `language: "en"`.

**Tech Stack:** Next.js 15 App Router route handlers, TypeScript, Supabase (PostgreSQL), recharts (via existing dashboard chart components), Vitest. n8n workflow JSON artifacts (edited as version-controlled files; live deploy is a separate ops step).

---

## Reality Check — what already exists (do NOT rebuild)

Before starting, confirm these are present (Task 6 asserts them in a test). **None of these need building:**

- **Voice sub-workflow:** `N8N-Workflow & Data Table/WA Voice Booking Processor.json` — 6 nodes: `When Called` (executeWorkflowTrigger), `Get_Media_URL`, `Download_Media`, `Whisper_Transcribe`, `Extract_Slots`, `Normalize_Voice`.
- **Main-workflow wiring:** `N8N-Workflow & Data Table/Premier-Cab-Main-Workflow.json` contains `Detect_Audio`, `IF_Voice`, `Execute_Voice` (executeWorkflow → voice sub-workflow), `Apply_Voice_Slots`, `Inject_Transcript`. Voice notes are merged back into the state machine at the intent router (`Inject_Transcript` rewrites the audio message as a text message carrying the transcript).
- **Transcript view:** `src/app/dashboard/automations/[automationId]/conversations/conversations-client.tsx` `MessageBubble` already has a `message.messageType === "voice"` branch rendering the transcript and an "Extracted slots" `<details>` from `intentExtracted`.

**The two gaps this plan closes:**
1. `analytics-client.tsx` section 10 ("Voice Note Stats") renders `<UnavailableCard message="Available once voice capture is enabled." />`, and `[metric]/route.ts` has `voice` in `STUB_METRICS`.
2. `Whisper_Transcribe.parameters.options` is hardcoded to `{ "language": "en" }`, and `Normalize_Voice` does not emit a `language` field — so detected language never reaches the `_voice` hand-off object.

**Scope note (honesty):** The main n8n workflow writes **only `bookings`** to Supabase; it does not write `conversations`/`messages` (those use n8n Data Tables for live state and are populated in Supabase by the Epic 9 seed for demo). Therefore deliverable 4's final hop "→ `conversations.language`" is satisfied at the **hand-off field** (`_voice.language` on the normalized output) — the field a future/external conversation-upsert consumes. This plan does **not** fabricate a conversation-write node that does not exist. The analytics section (Task 1–4) reads the real `messages`/`conversations` tables and works against seeded demo data today.

---

## File Structure

**Workstream A — Voice Analytics (Tasks 1–4):**
- Modify: `src/lib/dashboard/analytics-types.ts` — add `VoiceStats` interface.
- Modify: `src/lib/dashboard/analytics.ts` — add `reduceVoiceStats` (pure) + `getVoiceStats` (query).
- Modify: `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts` — register `voice` metric, drop it from `STUB_METRICS`.
- Modify: `src/app/dashboard/automations/[automationId]/analytics/analytics-client.tsx` — wire `voice` into metric state + render section 10.
- Modify: `tests/dashboard-7b-analytics.test.ts` — add `reduceVoiceStats` unit tests.
- Modify: `tests/dashboard-7b-api.test.ts` — update the voice metric assertion (now returns data; only `response-time` stays stubbed).

**Workstream B — Whisper Language Auto-Detect (Task 5):**
- Modify: `N8N-Workflow & Data Table/WA Voice Booking Processor.json` — `Whisper_Transcribe` options (auto-detect) + `Normalize_Voice` jsCode (emit `language`).
- Create: `tests/epic-10-voice-workflow.test.ts` — workflow-shape validation.

**Workstream C — Verification + roadmap (Task 6):**
- Modify: `tests/epic-10-voice-workflow.test.ts` — extend with "already-built wiring" assertions.
- Modify: `docs/superpowers/plans/00-cabbybot-roadmap.md` — flip Plan 10 marker to done.

Workstream A and Workstream B touch disjoint files and may be built in parallel. Task 6 runs after both.

---

## Task 1: `VoiceStats` type + `reduceVoiceStats` pure reducer (Workstream A)

**Files:**
- Modify: `src/lib/dashboard/analytics-types.ts`
- Modify: `src/lib/dashboard/analytics.ts`
- Test: `tests/dashboard-7b-analytics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/dashboard-7b-analytics.test.ts`. Also update the existing import on line 3 to include `reduceVoiceStats`:

```ts
// line 3 — add reduceVoiceStats to the existing import
import { reduceFunnel, reduceChannelMix, reduceModeSplit, reduceVehicleSplit, reduceTopZones, reduceHeatmap, reduceAbandonment, reduceVoiceStats } from "@/lib/dashboard/analytics";
```

```ts
describe("reduceVoiceStats", () => {
  const conversations = [
    { id: "c1", outcome: "booked", language: "en" },
    { id: "c2", outcome: "abandoned", language: "ar" },
    { id: "c3", outcome: "booked", language: "en" }, // no voice note
  ];
  const voiceMessages = [
    { conversation_id: "c1", transcript: "Taxi from Paddington to Soho please" }, // 35 chars
    { conversation_id: "c2", transcript: "" },                                     // failed transcription
  ];

  it("counts voice notes, voice conversations, and share of all conversations", () => {
    const s = reduceVoiceStats(voiceMessages as never, conversations as never);
    expect(s.totalVoiceNotes).toBe(2);
    expect(s.voiceConversations).toBe(2); // c1, c2
    expect(s.totalConversations).toBe(3);
    expect(s.voiceSharePct).toBe(67); // 2/3
  });

  it("computes transcription success, avg transcript length, and voice→booking rate", () => {
    const s = reduceVoiceStats(voiceMessages as never, conversations as never);
    expect(s.transcribedPct).toBe(50); // 1 of 2 has a non-empty transcript
    expect(s.avgTranscriptChars).toBe(35); // averaged over transcribed notes only
    expect(s.voiceBookingPct).toBe(50); // c1 booked of {c1, c2}
  });

  it("breaks voice conversations down by language, descending", () => {
    const s = reduceVoiceStats(voiceMessages as never, conversations as never);
    expect(s.languages).toEqual([
      { name: "en", value: 1 },
      { name: "ar", value: 1 },
    ]);
  });

  it("returns all-zero stats with no division-by-zero when there is no voice data", () => {
    const s = reduceVoiceStats([], []);
    expect(s).toEqual({
      totalVoiceNotes: 0, voiceConversations: 0, totalConversations: 0,
      voiceSharePct: 0, transcribedPct: 0, voiceBookingPct: 0,
      avgTranscriptChars: 0, languages: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-7b-analytics.test.ts -t reduceVoiceStats`
Expected: FAIL — `reduceVoiceStats is not a function` (not yet exported).

- [ ] **Step 3: Add the `VoiceStats` interface**

In `src/lib/dashboard/analytics-types.ts`, append (it already exports `NamedValue`):

```ts
export interface VoiceStats {
  totalVoiceNotes: number;
  voiceConversations: number;
  totalConversations: number;
  voiceSharePct: number;
  transcribedPct: number;
  voiceBookingPct: number;
  avgTranscriptChars: number;
  languages: NamedValue[];
}
```

- [ ] **Step 4: Write the reducer**

In `src/lib/dashboard/analytics.ts`, update the type import on line 3 to add `VoiceStats`:

```ts
import type { Funnel, NamedValue, ZoneRow, HeatmapCell, AbandonmentRow, AnalyticsRange, VoiceStats } from "./analytics-types";
```

Then add this exported function (place it after `reduceAbandonment`, before `getFunnel`):

```ts
export function reduceVoiceStats(
  voiceMessages: { conversation_id: string; transcript: string | null }[],
  conversations: { id: string; outcome: string | null; language: string | null }[],
): VoiceStats {
  const totalVoiceNotes = voiceMessages.length;
  const voiceConvIds = new Set(voiceMessages.map((m) => m.conversation_id));
  const voiceConversations = voiceConvIds.size;
  const totalConversations = conversations.length;

  const transcribed = voiceMessages.filter((m) => (m.transcript ?? "").trim().length > 0);
  const transcribedPct = totalVoiceNotes ? Math.round((transcribed.length / totalVoiceNotes) * 100) : 0;
  const avgTranscriptChars = transcribed.length
    ? Math.round(transcribed.reduce((sum, m) => sum + (m.transcript ?? "").trim().length, 0) / transcribed.length)
    : 0;

  const voiceConvs = conversations.filter((c) => voiceConvIds.has(c.id));
  const bookedVoice = voiceConvs.filter((c) => c.outcome === "booked").length;
  const voiceBookingPct = voiceConversations ? Math.round((bookedVoice / voiceConversations) * 100) : 0;
  const voiceSharePct = totalConversations ? Math.round((voiceConversations / totalConversations) * 100) : 0;

  const langMap = new Map<string, number>();
  for (const c of voiceConvs) {
    const k = c.language ?? "unknown";
    langMap.set(k, (langMap.get(k) ?? 0) + 1);
  }
  const languages = [...langMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalVoiceNotes, voiceConversations, totalConversations,
    voiceSharePct, transcribedPct, voiceBookingPct, avgTranscriptChars, languages,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-7b-analytics.test.ts -t reduceVoiceStats`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/analytics-types.ts src/lib/dashboard/analytics.ts tests/dashboard-7b-analytics.test.ts
git commit -m "feat(analytics): reduceVoiceStats pure reducer + VoiceStats type"
```

---

## Task 2: `getVoiceStats` query wrapper (Workstream A)

**Files:**
- Modify: `src/lib/dashboard/analytics.ts`
- Test: `tests/dashboard-7b-analytics.test.ts`

The async wrapper mirrors the existing `getFunnel` two-query pattern (conversations in range, then a second table) and accepts an injectable `client` so it is unit-testable with a hand-rolled fake — no live DB.

- [ ] **Step 1: Write the failing test**

Append to `tests/dashboard-7b-analytics.test.ts`. Add `getVoiceStats` to the import on line 3 alongside `reduceVoiceStats`:

```ts
describe("getVoiceStats", () => {
  it("queries conversations in range then voice messages, and reduces them", async () => {
    const calls: string[] = [];
    // Minimal chainable fake of the Supabase query builder used by getVoiceStats.
    function makeBuilder(rows: unknown[]) {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "lte", "in"]) {
        b[m] = (..._a: unknown[]) => b; // chainable
      }
      // resolves to { data } when awaited
      b.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: rows });
      return b;
    }
    const fake = {
      from(table: string) {
        calls.push(table);
        if (table === "conversations") {
          return makeBuilder([
            { id: "c1", outcome: "booked", language: "en" },
            { id: "c2", outcome: "abandoned", language: "ar" },
          ]);
        }
        return makeBuilder([
          { conversation_id: "c1", transcript: "hello there driver" },
          { conversation_id: "c2", transcript: "" },
        ]);
      },
    };
    const s = await getVoiceStats("a1", {}, fake as never);
    expect(calls).toEqual(["conversations", "messages"]);
    expect(s.totalConversations).toBe(2);
    expect(s.voiceConversations).toBe(2);
    expect(s.transcribedPct).toBe(50);
  });

  it("skips the messages query and returns zeros when there are no conversations", async () => {
    const calls: string[] = [];
    function emptyBuilder() {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "lte", "in"]) b[m] = () => b;
      b.then = (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: [] });
      return b;
    }
    const fake = { from(t: string) { calls.push(t); return emptyBuilder(); } };
    const s = await getVoiceStats("a1", {}, fake as never);
    expect(calls).toEqual(["conversations"]); // messages query skipped
    expect(s.totalVoiceNotes).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-7b-analytics.test.ts -t getVoiceStats`
Expected: FAIL — `getVoiceStats is not a function`.

- [ ] **Step 3: Write the query wrapper**

In `src/lib/dashboard/analytics.ts`, append after `getAbandonment`:

```ts
export async function getVoiceStats(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<VoiceStats> {
  const supabase = client ?? (await createClient());
  let cq = supabase.from("conversations").select("id, outcome, language").eq("automation_id", automationId);
  if (r.from) cq = cq.gte("started_at", r.from);
  if (r.to) cq = cq.lte("started_at", r.to);
  const { data: convs } = await cq;
  const conversations = (convs ?? []) as { id: string; outcome: string | null; language: string | null }[];

  const convIds = conversations.map((c) => c.id);
  let voiceMessages: { conversation_id: string; transcript: string | null }[] = [];
  if (convIds.length > 0) {
    const { data: vm } = await supabase
      .from("messages")
      .select("conversation_id, transcript")
      .eq("message_type", "voice")
      .in("conversation_id", convIds);
    voiceMessages = (vm ?? []) as { conversation_id: string; transcript: string | null }[];
  }

  return reduceVoiceStats(voiceMessages, conversations);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-7b-analytics.test.ts -t getVoiceStats`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/analytics.ts tests/dashboard-7b-analytics.test.ts
git commit -m "feat(analytics): getVoiceStats query (conversations + voice messages)"
```

---

## Task 3: Register the `voice` metric in the analytics route (Workstream A)

**Files:**
- Modify: `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts`
- Test: `tests/dashboard-7b-api.test.ts`

- [ ] **Step 1: Update the failing test**

In `tests/dashboard-7b-api.test.ts`:

(a) Extend the analytics mock (lines 6–10) to include `getVoiceStats`:

```ts
vi.mock("@/lib/dashboard/analytics", () => ({
  getFunnel: vi.fn(async () => ({ inbound: 0 })), getChannelMix: vi.fn(async () => []),
  getModeSplit: vi.fn(async () => []), getVehicleSplit: vi.fn(async () => []),
  getTopZones: vi.fn(async () => []), getHeatmap: vi.fn(async () => []), getAbandonment: vi.fn(async () => []),
  getVoiceStats: vi.fn(async () => ({ totalVoiceNotes: 3, voiceConversations: 2, totalConversations: 10, voiceSharePct: 20, transcribedPct: 100, voiceBookingPct: 50, avgTranscriptChars: 42, languages: [] })),
}));
```

(b) Replace the existing assertion (currently at lines 50–53) that voice returns `{ available: false }` with these two cases:

```ts
  it("returns { available: false } for response-time (still stubbed)", async () => {
    requireOrgAccess.mockResolvedValue({ tenant_id: "o1" });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "response-time" }));
    expect(await res.json()).toMatchObject({ available: false });
  });

  it("returns voice stats data for the voice metric", async () => {
    requireOrgAccess.mockResolvedValue({ tenant_id: "o1" });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "voice" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ metric: "voice", data: { voiceSharePct: 20 } });
  });
```

> Note: match the `requireOrgAccess.mockResolvedValue(...)` shape used by the existing passing test in this file (e.g. the "returns metric data" case) — copy whatever that case passes so the guard returns success.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-7b-api.test.ts -t voice`
Expected: FAIL — voice currently returns `{ available: false }`, so the "returns voice stats data" case fails.

- [ ] **Step 3: Wire the metric in the route**

In `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts`:

(a) Add `getVoiceStats` to the import block (lines 3–11):

```ts
import {
  getFunnel,
  getChannelMix,
  getModeSplit,
  getVehicleSplit,
  getTopZones,
  getHeatmap,
  getAbandonment,
  getVoiceStats,
} from "@/lib/dashboard/analytics";
```

(b) Add `voice` to the `METRICS` map (after `abandonment` on line 24):

```ts
  abandonment: (id, r) => getAbandonment(id, r),
  voice: (id, r) => getVoiceStats(id, r),
```

(c) Drop `voice` from `STUB_METRICS` (line 27) so only timing remains stubbed:

```ts
const STUB_METRICS = new Set(["response-time"]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-7b-api.test.ts`
Expected: PASS (all analytics cases green, including the new voice + response-time cases).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts" tests/dashboard-7b-api.test.ts
git commit -m "feat(analytics): serve voice metric via getVoiceStats; keep response-time stubbed"
```

---

## Task 4: Render the "Voice Note Stats" section in the dashboard (Workstream A)

**Files:**
- Modify: `src/app/dashboard/automations/[automationId]/analytics/analytics-client.tsx`

This replaces the section-10 `UnavailableCard` with a stat grid + a language donut. It reuses the existing `DonutChart`, `Skeleton`, `UnavailableCard`, `SectionCard`, and `MetricState` machinery already in the file.

- [ ] **Step 1: Import the `VoiceStats` type**

In `analytics-client.tsx`, find the `import type { ... } from "@/lib/dashboard/analytics-types"` block (around lines 10–17) and add `VoiceStats`:

```ts
import type {
  Funnel, NamedValue, ZoneRow, HeatmapCell, VoiceStats, AnalyticsRange,
} from "@/lib/dashboard/analytics-types";
```

> Keep whatever names are already imported; just add `VoiceStats`. (If `AnalyticsRange` is not currently imported, do not add it.)

- [ ] **Step 2: Add `voice` to the `AllMetrics` interface**

In the `interface AllMetrics { ... }` block (ends ~line 143), add:

```ts
  abandonment: MetricState<NamedValue[]>;
  voice: MetricState<VoiceStats>;
```

- [ ] **Step 3: Add `voice` to `emptyMetrics()`**

In `emptyMetrics()` (ends ~line 156), add to the returned object:

```ts
    abandonment: { status: "idle" },
    voice: { status: "idle" },
```

- [ ] **Step 4: Add `voice` to the loading-state object and the fetch batch**

In the `useEffect` (around lines 227–269):

(a) In the `setMetrics({ ... })` "set all to loading" object, add:

```ts
      abandonment: { status: "loading" },
      voice: { status: "loading" },
```

(b) In the `Promise.allSettled([...])` destructure + array, add `voiceRes` and `fetchMetric("voice")`:

```ts
      const [funnelRes, channelsRes, modeRes, vehicleRes, zonesRes, destsRes, heatmapRes, abandonRes, voiceRes] =
        await Promise.allSettled([
          fetchMetric("funnel"),
          fetchMetric("channels"),
          fetchMetric("mode"),
          fetchMetric("vehicle"),
          fetchMetric("zones"),
          fetchMetric("destinations"),
          fetchMetric("heatmap"),
          fetchMetric("abandonment"),
          fetchMetric("voice"),
        ]);
```

(c) In the final `setMetrics({ ... })` (around lines 260–269), add:

```ts
        abandonment: extract<NamedValue[]>(abandonRes, "data"),
        voice: extract<VoiceStats>(voiceRes, "data"),
```

- [ ] **Step 5: Add a `VoiceStatsPanel` component**

Add this component above `export function AnalyticsClient` (e.g. right after the `zoneColumns` definition, ~line 195):

```tsx
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function VoiceStatsPanel({ stats }: { stats: VoiceStats }) {
  if (stats.totalVoiceNotes === 0) {
    return <UnavailableCard message="No voice notes recorded for this period." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Voice notes" value={stats.totalVoiceNotes.toLocaleString()} />
        <StatTile label="Voice conversations" value={stats.voiceConversations.toLocaleString()} />
        <StatTile label="Share of chats" value={`${stats.voiceSharePct}%`} />
        <StatTile label="Transcribed" value={`${stats.transcribedPct}%`} />
        <StatTile label="Voice → booking" value={`${stats.voiceBookingPct}%`} />
        <StatTile label="Avg transcript" value={`${stats.avgTranscriptChars} chars`} />
      </div>
      {stats.languages.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Detected languages
          </div>
          <DonutChart data={stats.languages} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace the section-10 stub**

Replace the existing block:

```tsx
      {/* 10 — Voice Note Stats (not yet available) */}
      <SectionCard title="Voice Note Stats">
        <UnavailableCard message="Available once voice capture is enabled." />
      </SectionCard>
```

with:

```tsx
      {/* 10 — Voice Note Stats */}
      <SectionCard title="Voice Note Stats">
        {metrics.voice.status === "loading" ? (
          <Skeleton height={180} />
        ) : metrics.voice.status === "ok" ? (
          <VoiceStatsPanel stats={metrics.voice.data} />
        ) : metrics.voice.status === "error" ? (
          <UnavailableCard message="Could not load voice data." />
        ) : null}
      </SectionCard>
```

- [ ] **Step 7: Typecheck + full analytics test run**

Run: `pnpm typecheck && pnpm vitest run tests/dashboard-7b-analytics.test.ts tests/dashboard-7b-api.test.ts`
Expected: typecheck clean (no `voice` property errors on `AllMetrics`); tests PASS.

> If the project has no `typecheck` script, run `pnpm exec tsc --noEmit` instead.

- [ ] **Step 8: Commit**

```bash
git add "src/app/dashboard/automations/[automationId]/analytics/analytics-client.tsx"
git commit -m "feat(analytics): render Voice Note Stats section (stat grid + language donut)"
```

---

## Task 5: Whisper language auto-detect + emit `language` in the voice sub-workflow (Workstream B)

**Files:**
- Modify: `N8N-Workflow & Data Table/WA Voice Booking Processor.json`
- Test: `tests/epic-10-voice-workflow.test.ts`

The `Whisper_Transcribe` node hardcodes `options.language = "en"`, which forces English transcription and discards the detected language. Remove the forced language (so Whisper auto-detects, improving non-English transcription), and derive a coarse language code from the transcript script in `Normalize_Voice`, emitting it as `language` on the normalized output. `Inject_Transcript` already spreads the normalized object into `_voice`, so `_voice.language` becomes available to the conversation-write contract with no main-workflow change.

> The edits are to a JSON file with embedded JS in `Normalize_Voice.parameters.jsCode`. Edit precisely; keep all other nodes/connections untouched. The live n8n deploy of this artifact is a separate ops step (out of scope).

- [ ] **Step 1: Write the failing validation test**

Create `tests/epic-10-voice-workflow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VOICE_WF = join(process.cwd(), "N8N-Workflow & Data Table", "WA Voice Booking Processor.json");

function loadVoiceWorkflow() {
  const j = JSON.parse(readFileSync(VOICE_WF, "utf8")) as { nodes: { name: string; parameters: Record<string, unknown> }[] };
  return Object.fromEntries(j.nodes.map((n) => [n.name, n]));
}

describe("voice sub-workflow: Whisper language auto-detect", () => {
  it("Whisper_Transcribe no longer forces a hardcoded language", () => {
    const node = loadVoiceWorkflow()["Whisper_Transcribe"];
    const options = (node.parameters.options ?? {}) as Record<string, unknown>;
    expect(options.language).toBeUndefined();
  });

  it("Normalize_Voice derives and emits a `language` field", () => {
    const code = (loadVoiceWorkflow()["Normalize_Voice"].parameters.jsCode ?? "") as string;
    expect(code).toMatch(/function detectLang/);
    expect(code).toMatch(/language:\s*detectLang/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/epic-10-voice-workflow.test.ts`
Expected: FAIL — `options.language` is currently `"en"`, and `Normalize_Voice` has no `detectLang`.

- [ ] **Step 3: Remove the hardcoded Whisper language**

In `N8N-Workflow & Data Table/WA Voice Booking Processor.json`, find the `Whisper_Transcribe` node's parameters. Change:

```json
      "options": {
        "language": "en"
      }
```

to:

```json
      "options": {}
```

(Auto-detect: with no forced language, Whisper detects the spoken language for transcription.)

- [ ] **Step 4: Emit `language` from `Normalize_Voice`**

In the same file, in the `Normalize_Voice` node's `parameters.jsCode` string:

(a) Add a `detectLang` helper. Insert it immediately after the `const clean = ...` line (before the `VEHICLES` constant). Because the code lives inside a JSON string, every `\n` and `\"` must stay escaped exactly as the surrounding code already is — edit the JSON string literal, not a `.js` file. The helper to add:

```js
function detectLang(s) {
  const t = (s || '').toString();
  if (/[؀-ۿ]/.test(t)) return 'ar';   // Arabic
  if (/[Ѐ-ӿ]/.test(t)) return 'ru';   // Cyrillic
  if (/[一-鿿]/.test(t)) return 'zh';   // CJK
  if (/[ऀ-ॿ]/.test(t)) return 'hi';   // Devanagari
  return 'en';
}
```

(b) In the final returned object (`return [{ json: { ok: transcript.length > 0, transcript, intent, ... } }]`), add a `language` field right after `transcript`:

```js
  transcript,
  language:         detectLang(transcript),
  intent,
```

- [ ] **Step 5: Verify the JSON is still valid + tests pass**

Run: `node -e "JSON.parse(require('fs').readFileSync('N8N-Workflow & Data Table/WA Voice Booking Processor.json','utf8')); console.log('valid JSON')"`
Expected: prints `valid JSON`.

Run: `pnpm vitest run tests/epic-10-voice-workflow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add "N8N-Workflow & Data Table/WA Voice Booking Processor.json" tests/epic-10-voice-workflow.test.ts
git commit -m "feat(voice): Whisper language auto-detect + emit detected language on normalized output"
```

---

## Task 6: Verification test for already-built wiring + roadmap marker (Workstream C)

**Files:**
- Modify: `tests/epic-10-voice-workflow.test.ts`
- Modify: `docs/superpowers/plans/00-cabbybot-roadmap.md`

Runs after Tasks 1–5. Locks in the assertion that the previously-built pipeline (sub-workflow wiring + transcript view) is intact, so future edits can't silently break Epic 10's already-delivered surfaces.

- [ ] **Step 1: Add the wiring-present assertions**

Append to `tests/epic-10-voice-workflow.test.ts`:

```ts
import { existsSync } from "node:fs";

describe("voice pipeline: previously-built wiring is intact", () => {
  it("voice sub-workflow has the Whisper→extract→normalize node chain", () => {
    const nodes = loadVoiceWorkflow();
    for (const name of ["When Called", "Get_Media_URL", "Download_Media", "Whisper_Transcribe", "Extract_Slots", "Normalize_Voice"]) {
      expect(nodes[name], name).toBeDefined();
    }
  });

  it("main workflow routes audio into the voice sub-workflow and merges at the intent router", () => {
    const mainPath = join(process.cwd(), "N8N-Workflow & Data Table", "Premier-Cab-Main-Workflow.json");
    expect(existsSync(mainPath)).toBe(true);
    const j = JSON.parse(readFileSync(mainPath, "utf8")) as { nodes: { name: string }[] };
    const names = new Set(j.nodes.map((n) => n.name));
    for (const name of ["Detect_Audio", "IF_Voice", "Execute_Voice", "Apply_Voice_Slots", "Inject_Transcript"]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it("transcript view renders the voice branch (transcript + extracted slots)", () => {
    const tsx = readFileSync(
      join(process.cwd(), "src/app/dashboard/automations/[automationId]/conversations/conversations-client.tsx"),
      "utf8",
    );
    expect(tsx).toMatch(/messageType === "voice"/);
    expect(tsx).toMatch(/Extracted slots/);
  });
});
```

- [ ] **Step 2: Run the full voice test file**

Run: `pnpm vitest run tests/epic-10-voice-workflow.test.ts`
Expected: PASS (all cases — auto-detect + wiring present).

- [ ] **Step 3: Run the whole suite to confirm nothing regressed**

Run: `pnpm test`
Expected: PASS (no regressions in analytics, api, or other suites).

- [ ] **Step 4: Flip the roadmap marker**

In `docs/superpowers/plans/00-cabbybot-roadmap.md`, change the Plan 10 heading from:

```markdown
### ⬜ Plan 10 — Epic 10: Voice Pipeline Integration
```

to (use the merge HEAD from `git rev-parse --short HEAD` after Step 5's commit; the date is today, 2026-06-02):

```markdown
### ✅ Plan 10 — Epic 10: Voice Pipeline Integration  → `2026-06-02-epic-10-voice-pipeline.md`  (DONE & merged to `master` 2026-06-02, HEAD `<short-sha>`)
```

- [ ] **Step 5: Commit**

```bash
git add tests/epic-10-voice-workflow.test.ts docs/superpowers/plans/00-cabbybot-roadmap.md
git commit -m "test(voice): lock in voice-pipeline wiring + mark Epic 10 done in roadmap"
```

---

## Self-Review

**Spec coverage (roadmap Plan 10 deliverables):**
1. *WA Voice Booking Processor sub-workflow wired to WhatsApp automations (Whisper → GPT slot extraction → merge at intent router)* — already built; **verified** by Task 6.
2. *Dashboard conversation view renders transcript + extracted slots* — already built; **verified** by Task 6.
3. *Voice analytics section* — **built** by Tasks 1–4.
4. *Whisper language auto-detect → `conversations.language`* — **built** by Task 5 (auto-detect + emit `language` on `_voice` hand-off); end-to-end persistence depends on a conversation-write path that does not exist in the repo (documented in Scope note).
- *Perf target voice note → reply p95 ≤8s* — a runtime/observability concern measured under Epic 11 (Playwright E2E + load test); no code task here.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; tests include real assertions.

**Type consistency:** `VoiceStats` field names are identical across `analytics-types.ts` (Task 1), the reducer/query (Tasks 1–2), the API mock (Task 3), and the UI panel (Task 4): `totalVoiceNotes`, `voiceConversations`, `totalConversations`, `voiceSharePct`, `transcribedPct`, `voiceBookingPct`, `avgTranscriptChars`, `languages`. `reduceVoiceStats(voiceMessages, conversations)` argument order matches between definition (Task 1) and caller (Task 2). The emitted workflow field `language` matches the test assertions in Task 5.

**Parallelization:** Workstream A (Tasks 1→4, sequential within) and Workstream B (Task 5) touch disjoint files and can be built by parallel agents; Task 6 runs after both and is the integration gate.
