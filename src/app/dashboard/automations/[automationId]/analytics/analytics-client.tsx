"use client";

import React, { useEffect, useState, useCallback } from "react";
import { FunnelChart } from "@/components/dashboard/charts/funnel-chart";
import { DonutChart } from "@/components/dashboard/charts/donut-chart";
import { BarChart } from "@/components/dashboard/charts/bar-chart";
import { HorizontalBarChart } from "@/components/dashboard/charts/horizontal-bar-chart";
import { Heatmap } from "@/components/dashboard/charts/heatmap";
import { DataTable } from "@/components/dashboard/data-table";
import type {
  Funnel,
  NamedValue,
  ZoneRow,
  HeatmapCell,
  VoiceStats,
} from "@/lib/dashboard/analytics-types";
import type { ResponseStats, RevenueSummary, AirportStats } from "@/lib/dashboard/insights-types";

// ——— date helpers ——————————————————————————————————————————

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: toDateStr(from), to: toDateStr(to) };
}

// ——— loading skeleton ——————————————————————————————————————

function Skeleton({ height = 256 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-gray-100"
      style={{ height }}
      aria-label="Loading…"
    />
  );
}

// ——— unavailable empty state ——————————————————————————————

function UnavailableCard({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-6 py-10 text-center"
      style={{ minHeight: 120 }}
    >
      <svg
        className="h-6 w-6 text-gray-300"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

// ——— section card wrapper ————————————————————————————————

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase font-mono">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ——— date range controls ——————————————————————————————————

function DateRangeBar({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-gray-500 font-mono">
        From
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => onChange(e.target.value, to)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20 cursor-pointer transition-colors duration-150"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-500 font-mono">
        To
        <input
          type="date"
          value={to}
          min={from}
          max={toDateStr(new Date())}
          onChange={(e) => onChange(from, e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20 cursor-pointer transition-colors duration-150"
        />
      </label>
    </div>
  );
}

// ——— types ———————————————————————————————————————————————

type MetricState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

interface AllMetrics {
  funnel: MetricState<Funnel>;
  channels: MetricState<NamedValue[]>;
  mode: MetricState<NamedValue[]>;
  vehicle: MetricState<NamedValue[]>;
  zones: MetricState<ZoneRow[]>;
  destinations: MetricState<ZoneRow[]>;
  heatmap: MetricState<HeatmapCell[]>;
  abandonment: MetricState<NamedValue[]>;
  voice: MetricState<VoiceStats>;
  responseTime: MetricState<ResponseStats>;
  revenue: MetricState<RevenueSummary>;
  airport: MetricState<AirportStats>;
}

function emptyMetrics(): AllMetrics {
  return {
    funnel: { status: "idle" },
    channels: { status: "idle" },
    mode: { status: "idle" },
    vehicle: { status: "idle" },
    zones: { status: "idle" },
    destinations: { status: "idle" },
    heatmap: { status: "idle" },
    abandonment: { status: "idle" },
    voice: { status: "idle" },
    responseTime: { status: "idle" },
    revenue: { status: "idle" },
    airport: { status: "idle" },
  };
}

// ——— funnel mapping ——————————————————————————————————————

function mapFunnel(f: Funnel): { stage: string; count: number; pct: number }[] {
  const inbound = f.inbound || 0;
  const guard = inbound > 0 ? inbound : 1;
  return [
    { stage: "Inbound", count: f.inbound, pct: 100 },
    { stage: "Greeted", count: f.greeted, pct: Math.round((f.greeted / guard) * 100) },
    { stage: "Intent", count: f.intent, pct: Math.round((f.intent / guard) * 100) },
    { stage: "Quoted", count: f.quoted, pct: Math.round((f.quoted / guard) * 100) },
    { stage: "Confirmed", count: f.confirmed, pct: Math.round((f.confirmed / guard) * 100) },
    { stage: "Booked", count: f.booked, pct: Math.round((f.booked / guard) * 100) },
  ];
}

// ——— zone table columns ——————————————————————————————————

const zoneColumns = [
  {
    key: "zone",
    header: "Zone",
    render: (row: ZoneRow) => row.zone,
  },
  {
    key: "count",
    header: "Count",
    render: (row: ZoneRow) => row.count.toLocaleString(),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "pct",
    header: "%",
    render: (row: ZoneRow) => `${row.pct}%`,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums text-gray-500",
  },
];

// ——— voice stats panel ———————————————————————————————————

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</div>
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
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Detected languages
          </div>
          <DonutChart data={stats.languages} />
        </div>
      )}
    </div>
  );
}

// ——— main client component ———————————————————————————————

export function AnalyticsClient({
  orgId,
  automationId,
  isBooking,
}: {
  orgId: string;
  automationId: string;
  isBooking: boolean;
}) {
  const [range, setRange] = useState(defaultRange);
  const [metrics, setMetrics] = useState<AllMetrics>(emptyMetrics);

  const fetchMetric = useCallback(
    async (metric: string): Promise<unknown> => {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/analytics/${metric}?${qs}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [orgId, automationId, range]
  );

  useEffect(() => {
    let cancelled = false;

    // Set all to loading
    setMetrics({
      funnel: { status: "loading" },
      channels: { status: "loading" },
      mode: { status: "loading" },
      vehicle: { status: "loading" },
      zones: { status: "loading" },
      destinations: { status: "loading" },
      heatmap: { status: "loading" },
      abandonment: { status: "loading" },
      voice: { status: "loading" },
      responseTime: { status: "loading" },
      revenue: { status: "loading" },
      airport: { status: "loading" },
    });

    const run = async () => {
      const [funnelRes, channelsRes, modeRes, vehicleRes, zonesRes, destsRes, heatmapRes, abandonRes, voiceRes, responseRes, revenueRes, airportRes] =
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
          fetchMetric("response-time"),
          fetchMetric("revenue"),
          fetchMetric("airport"),
        ]);

      if (cancelled) return;

      function extract<T>(res: PromiseSettledResult<unknown>, field: "data"): MetricState<T> {
        if (res.status === "rejected") return { status: "error", message: String(res.reason) };
        const body = res.value as Record<string, unknown>;
        if (body[field] === undefined) return { status: "error", message: "Unexpected response" };
        return { status: "ok", data: body[field] as T };
      }

      setMetrics({
        funnel: extract<Funnel>(funnelRes, "data"),
        channels: extract<NamedValue[]>(channelsRes, "data"),
        mode: extract<NamedValue[]>(modeRes, "data"),
        vehicle: extract<NamedValue[]>(vehicleRes, "data"),
        zones: extract<ZoneRow[]>(zonesRes, "data"),
        destinations: extract<ZoneRow[]>(destsRes, "data"),
        heatmap: extract<HeatmapCell[]>(heatmapRes, "data"),
        abandonment: extract<NamedValue[]>(abandonRes, "data"),
        voice: extract<VoiceStats>(voiceRes, "data"),
        responseTime: extract<ResponseStats>(responseRes, "data"),
        revenue: extract<RevenueSummary>(revenueRes, "data"),
        airport: extract<AirportStats>(airportRes, "data"),
      });
    };

    run();
    return () => { cancelled = true; };
  }, [fetchMetric]);

  const handleRangeChange = (from: string, to: string) => {
    setRange({ from, to });
  };

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 min-w-0">
      {/* Date range toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-gray-800 font-mono">Analytics</h1>
        <DateRangeBar
          from={range.from}
          to={range.to}
          onChange={handleRangeChange}
        />
      </div>

      {/* 1 — Conversion Funnel */}
      <SectionCard title="Conversion Funnel">
        {metrics.funnel.status === "loading" ? (
          <Skeleton />
        ) : metrics.funnel.status === "ok" ? (
          <FunnelChart data={mapFunnel(metrics.funnel.data)} />
        ) : metrics.funnel.status === "error" ? (
          <UnavailableCard message="Could not load funnel data." />
        ) : null}
      </SectionCard>

      {/* 2 — Channel Mix */}
      <SectionCard title="Channel Mix">
        {metrics.channels.status === "loading" ? (
          <Skeleton />
        ) : metrics.channels.status === "ok" ? (
          <DonutChart data={metrics.channels.data} />
        ) : metrics.channels.status === "error" ? (
          <UnavailableCard message="Could not load channel data." />
        ) : null}
      </SectionCard>

      {/* 3 — Booking Mode Split (booking automations only) */}
      {isBooking && (
        <SectionCard title="Booking Mode Split">
          {metrics.mode.status === "loading" ? (
            <Skeleton />
          ) : metrics.mode.status === "ok" ? (
            <BarChart data={metrics.mode.data} />
          ) : metrics.mode.status === "error" ? (
            <UnavailableCard message="Could not load mode data." />
          ) : null}
        </SectionCard>
      )}

      {/* 4 — Vehicle Breakdown (booking automations only) */}
      {isBooking && (
        <SectionCard title="Vehicle Breakdown">
          {metrics.vehicle.status === "loading" ? (
            <Skeleton />
          ) : metrics.vehicle.status === "ok" ? (
            <HorizontalBarChart data={metrics.vehicle.data} />
          ) : metrics.vehicle.status === "error" ? (
            <UnavailableCard message="Could not load vehicle data." />
          ) : null}
        </SectionCard>
      )}

      {/* 5 — Top Pickup Zones */}
      <SectionCard title="Top Pickup Zones">
        {metrics.zones.status === "loading" ? (
          <Skeleton height={160} />
        ) : metrics.zones.status === "ok" ? (
          <DataTable
            columns={zoneColumns}
            rows={metrics.zones.data}
            getRowKey={(r) => r.zone}
            emptyMessage="No pickup zones recorded for this period."
          />
        ) : metrics.zones.status === "error" ? (
          <UnavailableCard message="Could not load zone data." />
        ) : null}
      </SectionCard>

      {/* 6 — Top Destinations */}
      <SectionCard title="Top Destinations">
        {metrics.destinations.status === "loading" ? (
          <Skeleton height={160} />
        ) : metrics.destinations.status === "ok" ? (
          <DataTable
            columns={zoneColumns}
            rows={metrics.destinations.data}
            getRowKey={(r) => r.zone}
            emptyMessage="No destinations recorded for this period."
          />
        ) : metrics.destinations.status === "error" ? (
          <UnavailableCard message="Could not load destination data." />
        ) : null}
      </SectionCard>

      {/* 7 — Peak Hours Heatmap */}
      <SectionCard title="Peak Hours Heatmap">
        {metrics.heatmap.status === "loading" ? (
          <Skeleton height={200} />
        ) : metrics.heatmap.status === "ok" ? (
          <Heatmap cells={metrics.heatmap.data} />
        ) : metrics.heatmap.status === "error" ? (
          <UnavailableCard message="Could not load heatmap data." />
        ) : null}
      </SectionCard>

      {/* 8 — Response Time */}
      <SectionCard title="Response Time">
        {metrics.responseTime.status === "loading" ? (
          <Skeleton height={120} />
        ) : metrics.responseTime.status === "ok" ? (
          metrics.responseTime.data.sampleSize === 0 ? (
            <UnavailableCard message="No measurable responses in this period." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Avg" value={`${metrics.responseTime.data.avgSeconds}s`} />
              <StatTile label="Median" value={`${metrics.responseTime.data.p50Seconds}s`} />
              <StatTile label="P95" value={`${metrics.responseTime.data.p95Seconds}s`} />
              <StatTile label="Sample" value={metrics.responseTime.data.sampleSize.toLocaleString()} />
            </div>
          )
        ) : metrics.responseTime.status === "error" ? (
          <UnavailableCard message="Could not load response-time data." />
        ) : null}
      </SectionCard>

      {/* 8b — Revenue */}
      <SectionCard title="Revenue & Completion">
        {metrics.revenue.status === "loading" ? (
          <Skeleton height={120} />
        ) : metrics.revenue.status === "ok" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Revenue" value={`£${metrics.revenue.data.totalFare.toLocaleString()}`} />
              <StatTile label="Avg fare" value={`£${metrics.revenue.data.avgFare}`} />
              <StatTile label="Completion" value={`${metrics.revenue.data.completionPct}%`} />
              <StatTile label="Bookings" value={metrics.revenue.data.bookingCount.toLocaleString()} />
            </div>
            {metrics.revenue.data.byStatus.length > 0 && <HorizontalBarChart data={metrics.revenue.data.byStatus} />}
          </div>
        ) : metrics.revenue.status === "error" ? (
          <UnavailableCard message="Could not load revenue data." />
        ) : null}
      </SectionCard>

      {/* 8c — Airport & Flights */}
      <SectionCard title="Airport & Flights">
        {metrics.airport.status === "loading" ? (
          <Skeleton height={120} />
        ) : metrics.airport.status === "ok" ? (
          metrics.airport.data.totalBookings === 0 ? (
            <UnavailableCard message="No bookings recorded for this period." />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile label="Airport bookings" value={metrics.airport.data.airportBookings.toLocaleString()} />
                <StatTile label="Share" value={`${metrics.airport.data.airportSharePct}%`} />
                {metrics.airport.data.topAirports[0] && (
                  <StatTile label="Top airport" value={metrics.airport.data.topAirports[0].name} />
                )}
              </div>
              {metrics.airport.data.topTerminals.length > 0 && (
                <HorizontalBarChart data={metrics.airport.data.topTerminals} />
              )}
            </div>
          )
        ) : metrics.airport.status === "error" ? (
          <UnavailableCard message="Could not load airport data." />
        ) : null}
      </SectionCard>

      {/* 9 — Abandonment Reasons */}
      <SectionCard title="Abandonment Reasons">
        {metrics.abandonment.status === "loading" ? (
          <Skeleton />
        ) : metrics.abandonment.status === "ok" ? (
          <HorizontalBarChart data={metrics.abandonment.data} />
        ) : metrics.abandonment.status === "error" ? (
          <UnavailableCard message="Could not load abandonment data." />
        ) : null}
      </SectionCard>

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
    </div>
  );
}
