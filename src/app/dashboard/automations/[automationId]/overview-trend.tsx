"use client";

import { TrendChart } from "@/components/dashboard/charts/trend-chart";
import type { TrendPoint } from "@/lib/dashboard/insights-types";

/** Thin client wrapper so the server overview page can hand TrendChart its data. */
export function OverviewTrend({ data }: { data: TrendPoint[] }) {
  return <TrendChart data={data} />;
}
