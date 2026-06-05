export interface ReportMetricDef {
  key: string;
  label: string;
  /** Turn a raw metric value object into label/value rows. */
  toRows: (value: unknown) => { label: string; value: string }[];
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export const REPORT_METRICS: Record<string, ReportMetricDef> = {
  revenue: {
    key: "revenue",
    label: "Revenue & completion",
    toRows: (v) => {
      const o = (v ?? {}) as { total?: number; completed?: number };
      return [
        { label: "Total revenue", value: `£${num(o.total).toFixed(2)}` },
        { label: "Completed journeys", value: String(num(o.completed)) },
      ];
    },
  },
  response_time: {
    key: "response_time",
    label: "Response time",
    toRows: (v) => {
      const o = (v ?? {}) as { p50Sec?: number; p95Sec?: number };
      return [
        { label: "Median reply", value: `${num(o.p50Sec)}s` },
        { label: "p95 reply", value: `${num(o.p95Sec)}s` },
      ];
    },
  },
  bookings: {
    key: "bookings",
    label: "Bookings",
    toRows: (v) => {
      const o = (v ?? {}) as { total?: number };
      return [{ label: "Total bookings", value: String(num(o.total)) }];
    },
  },
};

export interface ReportSection { key: string; title: string; rows: { label: string; value: string }[] }
export interface Report { title: string; generatedAt: string; sections: ReportSection[] }

/** Pure: assemble a report from selected metric keys + a fetched values map. */
export function buildReport(metricKeys: string[], values: Record<string, unknown>, title = "Report"): Report {
  const sections: ReportSection[] = [];
  for (const key of metricKeys) {
    const def = REPORT_METRICS[key];
    if (!def) continue;
    sections.push({ key, title: def.label, rows: def.toRows(values[key]) });
  }
  return { title, generatedAt: new Date().toISOString(), sections };
}

export interface Branding { logoUrl: string | null; primary: string; accent: string }

const DEFAULT_BRANDING: Branding = { logoUrl: null, primary: "#1E40AF", accent: "#F59E0B" };

/** Pure: merge a tenant's stored branding over the platform defaults. */
export function resolveBranding(branding: Record<string, unknown> | null): Branding {
  const b = branding ?? {};
  return {
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : DEFAULT_BRANDING.logoUrl,
    primary: typeof b.primary === "string" ? b.primary : DEFAULT_BRANDING.primary,
    accent: typeof b.accent === "string" ? b.accent : DEFAULT_BRANDING.accent,
  };
}
