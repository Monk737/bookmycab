export type Attrs = Record<string, string | number | boolean>;

export interface SpanRecord {
  name: string;
  attributes: Attrs;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
}

export interface MetricRecord {
  name: string;
  kind: "counter" | "histogram";
  value: number;
  attributes: Attrs;
}

export interface ErrorRecord {
  name: string;
  message: string;
  attributes: Attrs;
}

export interface TelemetrySink {
  span(record: SpanRecord): void;
  metric(record: MetricRecord): void;
  error(record: ErrorRecord): void;
}

/** Default sink: discards everything. Active until initObservability swaps it. */
export const noopSink: TelemetrySink = {
  span() {},
  metric() {},
  error() {},
};

/** Test/inspection sink: keeps every record in memory. */
export class MemorySink implements TelemetrySink {
  readonly spans: SpanRecord[] = [];
  readonly metrics: MetricRecord[] = [];
  readonly errors: ErrorRecord[] = [];
  span(record: SpanRecord) { this.spans.push(record); }
  metric(record: MetricRecord) { this.metrics.push(record); }
  error(record: ErrorRecord) { this.errors.push(record); }
}

/** Deploy sink: one OTLP-shaped JSON line per record on stdout for a log scraper. */
export class StructuredLogSink implements TelemetrySink {
  span(record: SpanRecord) { console.log(JSON.stringify({ t: "span", ...record })); }
  metric(record: MetricRecord) { console.log(JSON.stringify({ t: "metric", ...record })); }
  error(record: ErrorRecord) { console.log(JSON.stringify({ t: "error", ...record })); }
}

let current: TelemetrySink = noopSink;
export function setSink(sink: TelemetrySink): void { current = sink; }
export function getSink(): TelemetrySink { return current; }
export function resetSink(): void { current = noopSink; }
