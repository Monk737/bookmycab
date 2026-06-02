"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { NamedValue } from "@/lib/dashboard/analytics-types";

// palette: bar fill = blue-600, axis/grid = slate-400
const COLOR_BAR = "#2563eb"; // blue-600
const COLOR_MUTED = "#94a3b8"; // slate-400

export function HorizontalBarChart({
  data,
}: {
  data: NamedValue[];
}): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div
        style={{ height: 256 }}
        className="flex items-center justify-center text-sm text-slate-400"
      >
        No data for this period.
      </div>
    );
  }

  // dynamic height: at least 256, grow by 32px per item beyond 4
  const chartHeight = Math.max(256, data.length * 36);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
      >
        <XAxis
          type="number"
          tick={{ fill: COLOR_MUTED, fontSize: 12 }}
          axisLine={{ stroke: COLOR_MUTED, opacity: 0.4 }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: COLOR_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 12,
          }}
          cursor={{ fill: COLOR_MUTED, opacity: 0.1 }}
        />
        <Bar
          dataKey="value"
          fill={COLOR_BAR}
          radius={[0, 4, 4, 0]}
          name="Value"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
