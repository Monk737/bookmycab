"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Data palette: blue-800, blue-600, amber-500, emerald-500, violet-500, slate-400
const PALETTE = [
  "#1e40af", // blue-800
  "#2563eb", // blue-600
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#94a3b8", // slate-400
];

const COLOR_GRID = "#94a3b8";

export function DonutChart({
  data,
}: {
  data: { name: string; value: number }[];
}): React.JSX.Element {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div
        style={{ height: 256 }}
        className="flex items-center justify-center text-sm text-slate-400"
      >
        No data for this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PALETTE[index % PALETTE.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: COLOR_GRID }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
