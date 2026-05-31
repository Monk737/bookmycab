-- Conversations (one per customer chat session per automation)
create table public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  automation_id      uuid not null references public.automations(id) on delete cascade,
  channel_id         uuid references public.channels(id),
  customer_handle    text not null,
  customer_name      text,
  language           text default 'en',
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  outcome            text check (outcome in ('booked','quoted','abandoned','managed','cancelled','unknown')),
  abandonment_reason text
);
create index conversations_automation_idx on public.conversations (automation_id);
create index conversations_tenant_idx on public.conversations (tenant_id);

-- Messages (every turn in a conversation)
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        text not null check (direction in ('inbound','outbound')),
  message_type     text not null default 'text' check (message_type in ('text','voice','location','image','interactive','card')),
  payload          jsonb not null,
  transcript       text,
  intent_extracted jsonb,
  ts               timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id);

-- Bookings (one per confirmed booking)
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  automation_id       uuid not null references public.automations(id) on delete cascade,
  conversation_id     uuid references public.conversations(id),
  channel_type        text,
  dispatch_ref        text,
  dispatch_adapter    text,
  passenger_name      text,
  customer_handle     text,
  pickup_address      jsonb,
  destination_address jsonb,
  vehicle_type        text,
  passenger_count     integer,
  fare                numeric(10,2),
  currency            text default 'GBP',
  pickup_at_utc       timestamptz,
  pickup_time_mode    text,
  airport_json        jsonb,
  driver_note         text,
  payment_method      text,
  status              text not null default 'confirmed' check (status in ('confirmed','dispatched','completed','cancelled','no_show')),
  your_reference_1    text,
  your_reference_2    text,
  your_reference_3    text,
  raw_dispatch_json   jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz default now()
);
create index bookings_automation_idx on public.bookings (automation_id);
create index bookings_tenant_idx on public.bookings (tenant_id);

-- Automation runs (engine runs synced into Supabase)
create table public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.automations(id) on delete cascade,
  engine_run_id   text,
  status          text not null check (status in ('running','success','error','cancelled')),
  started_at      timestamptz not null,
  finished_at     timestamptz,
  duration_ms     integer,
  error_message   text,
  trigger_channel text,
  trigger_phone   text   -- sanitised; no raw PII
);
create index automation_runs_automation_idx on public.automation_runs (automation_id);
