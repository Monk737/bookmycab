-- 0031: Platform notification senders (global, FlowMo-owned).
--
-- Resend domains, Twilio numbers, Slack apps used to deliver tenant alerts.
-- Global config — RLS enabled with NO tenant policy (service-role only), like
-- platform_apps (0028).

create table public.platform_senders (
  id              uuid primary key default gen_random_uuid(),
  type text not null check (type in ('email','sms','slack')),
  identifier      text not null,
  provider        text,
  credentials_ref text,
  status          text not null default 'active' check (status in ('active','disabled')),
  created_at      timestamptz not null default now()
);

alter table public.platform_senders enable row level security;
