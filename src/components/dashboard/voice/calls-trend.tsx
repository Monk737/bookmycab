"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { INK, AMBER, GRID, AXIS } from "@/lib/dashboard/chart-colors";

type Point = { date: string; calls: number; booked: number };

function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

/* Brutalist tooltip: ink frame, hard shadow, mono figures. */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const calls = payload.find((p) => p.dataKey === "calls")?.value ?? 0;
  const booked = payload.find((p) => p.dataKey === "booked")?.value ?? 0;
  return (
    <div className="border-[3px] border-ink bg-paper px-3 py-2 shadow-brut">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-600">{label ? shortDay(label) : ""}</p>
      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-ink">{calls} calls</p>
      <p className="font-mono text-xs tabular-nums text-gray-600">{booked} booked</p>
    </div>
  );
}

/** Daily call volume with the booked portion called out in amber. */
export function CallsTrend({ data }: { data: Point[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={1}>
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
            allowDecimals={false}
            width={34}
            tickFormatter={(v: number) => String(v)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(10,10,10,0.06)" }} />
          {/* Total calls as the ink bar; booked overlaps in amber so the share reads at a glance. */}
          <Bar dataKey="calls" fill={INK} isAnimationActive={false} />
          <Bar dataKey="booked" fill={AMBER} stroke={INK} strokeWidth={1.5} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
