-- The engine (n8n) webhook URL the gateway forwards inbound channel events to.
-- One per automation; set at provisioning/build time. Internal only — never
-- surfaced to tenants. Nullable: an automation in build_stage Requested/Scoped
-- has no engine webhook yet.
alter table public.automations
  add column engine_webhook_url text;

comment on column public.automations.engine_webhook_url is
  'Internal n8n webhook URL the edge gateway forwards channel events to. Never exposed to customers.';
