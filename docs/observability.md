# Observability & QA Runbook (Epic 11)

BookMyCab ships a vendor-neutral telemetry core that no-ops by default. Activation is deploy-time.

## Telemetry

Spans/metrics/errors flow through `src/lib/observability` to the active `TelemetrySink`.
Default is `noopSink`. The Next.js `instrumentation.ts` hook calls `initObservability()`,
which installs `StructuredLogSink` when `OBSERVABILITY_STDOUT=true` — one OTLP-shaped JSON
line per record on stdout.

### Wiring to Grafana Cloud / Sentry (deploy)
1. Set `OBSERVABILITY_STDOUT=true`.
2. Run a log scraper (Grafana Agent / Vector) that parses the `{ "t": "span"|"metric"|"error" }`
   stdout lines and forwards to Grafana Cloud (Mimir/Tempo/Loki) and Sentry.
3. Alternatively, install the OTel SDK and replace `StructuredLogSink` with an OTLP exporter
   sink in `src/lib/observability/init.ts` using `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Metric contract
`webhook_ack_ms`, `webhook_inbound_total`, `engine_request_ms`, `dispatch_latency_ms`.
Dashboard: import `observability/grafana/bookmycab-overview.json` into Grafana Cloud.

## Load test
`pnpm loadtest:webhook -- --url <gateway-url> --total 1000 --concurrency 100`
Fails if ACK p95 > 300ms (PRD §11).

## E2E (Playwright)
One-time: `pnpm add -D @playwright/test && pnpm exec playwright install`.
Run against a deployed/dev app: `E2E_BASE_URL=https://staging pnpm test:e2e`.
Scenarios: text booking, voice booking, manage booking, admin provisioning, demo tenant.
