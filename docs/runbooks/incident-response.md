# Incident Response Runbook

Companion to the observability runbook (`docs/observability.md`) and the public
status page (`/status`).

## Severity levels
- **SEV1** — platform down or bookings not dispatching for multiple tenants.
- **SEV2** — degraded for one tenant or one channel; workaround exists.
- **SEV3** — minor/cosmetic; no booking impact.

## On-call
- The on-call engineer acknowledges via the alert channel, opens an incident doc, and takes incident-commander role for SEV1/SEV2.
- Triage with Grafana dashboards (latency, error rate, webhook throughput, dispatch latency per adapter) and Sentry.

## Communication
- Update `/status` component states (degraded/outage) for customer-visible impact.
- For SEV1, notify affected tenant Owners by email; give an ETA and updates at a fixed cadence.

## Post-incident
- Within 3 business days, write a blameless post-mortem: timeline, root cause, customer impact, and corrective actions with owners and dates.
