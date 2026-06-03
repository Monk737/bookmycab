import { setSink, StructuredLogSink } from "./sink";

/**
 * Selects the active telemetry sink at process boot. Default stays no-op; when
 * OBSERVABILITY_STDOUT=true we emit OTLP-shaped JSON lines for a log scraper to
 * forward to Grafana Cloud / Sentry (see docs/observability.md).
 *
 * Reads OBSERVABILITY_STDOUT from process.env directly so the Next.js
 * instrumentation hook can call this before the validated env accessor is ready.
 */
export function initObservability(): void {
  if (process.env.OBSERVABILITY_STDOUT === "true") {
    setSink(new StructuredLogSink());
  }
}
