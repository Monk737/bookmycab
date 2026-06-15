"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { INK, GRID, AXIS } from "@/lib/dashboard/chart-colors";
import type { HandleTrendPoint } from "@/lib/voice/quality";

function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}
function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

// Days with no calls carry a null so the line bridges the gap instead of
// crashing to 0:00 and misreading as a sudden drop in handle time.
type Pt = { date: string; avgS: number | null; calls: number };

function HandleTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: Pt }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.calls === 0) return null;
  return (
    <div className="border-[3px] border-ink bg-paper px-3 py-2 shadow-brut">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-600">{label ? shortDay(label) : ""}</p>
      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-ink">{mmss(p.avgS ?? 0)} avg</p>
      <p className="font-mono text-xs tabular-nums text-gray-600">{p.calls} call{p.calls === 1 ? "" : "s"}</p>
    </div>
  );
}

/** Mean call length per day (14 days) as a hard-cornered ink trend line. */
export function HandleTrend({ data }: { data: HandleTrendPoint[] }) {
  const pts: Pt[] = data.map((d) => ({ date: d.date, avgS: d.calls > 0 ? d.avgS : null, calls: d.calls }));
  if (!pts.some((p) => p.avgS != null)) {
    return (
      <div className="flex h-44 items-center justify-center border-[3px] border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
        No handle-time data in this window yet.
      </div>
    );
  }
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={{ fill: AXIS, fontSize: 10, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: INK, strokeWidth: 2 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 10, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={mmss}
          />
          <Tooltip content={<HandleTooltip />} cursor={{ stroke: INK, strokeWidth: 1 }} />
          <Line
            type="linear"
            dataKey="avgS"
            stroke={INK}
            strokeWidth={2.5}
            connectNulls
            dot={{ fill: INK, r: 2.5, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: INK, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
