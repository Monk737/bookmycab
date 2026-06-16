-- 0064_chat_ingest.sql
--
-- WhatsApp Chatbot (Chat + Voice Note) → dashboard mirror pipeline.
--
-- The Chat product is the twin n8n workflow pair (text chat + WhatsApp voice
-- note). A Voice Note is a WhatsApp audio message transcribed back into the same
-- booking state machine — it is NOT a phone call: there is no calling, no Vapi,
-- no per-call credit. So unlike the AI Voice pipeline (record_voice_call), this
-- has NO metering/credit hooks. It only MIRRORS conversation outcomes + dispatch
-- bookings from n8n into the existing domain tables the Chat dashboard already
-- reads (conversations, bookings), via two SECURITY DEFINER upsert RPCs called by
-- the bearer-authed chat ingest endpoints with the service role.
--
-- Mirrors the voice_bookings conventions: tenant-scoped SELECT only (RLS already
-- on conversations/bookings), writes exclusively through the RPCs, idempotent.

-- 1. Conversation identity for idempotent mirroring.
--    conversation_ref is the per-journey key the workflow supplies (phone:UK-day),
--    so repeated mirror calls upsert one row instead of duplicating. via_voice
--    flags journeys that involved a WhatsApp voice note (analytics dimension only).
alter table public.conversations
  add column if not exists conversation_ref text,
  add column if not exists via_voice boolean not null default false;

-- NULLs never conflict, so legacy/seed rows (conversation_ref null) are unaffected.
create unique index if not exists conversations_tenant_ref_uniq
  on public.conversations (tenant_id, conversation_ref);

-- One booking row per dispatch reference per tenant (idempotent re-mirrors).
-- Pre-existing duplicate dispatch_refs (demo-seed artifacts) would block the
-- unique index, so first disambiguate them: keep the earliest row's ref intact
-- and suffix any later duplicate. Non-destructive (no rows removed) and a no-op
-- on a clean database where refs are already unique.
with dups as (
  select id, row_number() over (
           partition by tenant_id, dispatch_ref order by created_at, id
         ) as rn
    from public.bookings
   where dispatch_ref is not null
)
update public.bookings b
   set dispatch_ref = b.dispatch_ref || '-dup' || dups.rn
  from dups
 where dups.id = b.id and dups.rn > 1;

create unique index if not exists bookings_tenant_dispatch_ref_uniq
  on public.bookings (tenant_id, dispatch_ref)
  where dispatch_ref is not null;

-- 2. Per-tenant record of the twin n8n workflow ids (admin reference + activation).
--    engine_workflow_id already holds the CHAT workflow id; this adds the paired
--    Voice-Note sub-workflow id. Internal only — never surfaced to tenants.
alter table public.automations
  add column if not exists voice_note_workflow_id text;

comment on column public.automations.voice_note_workflow_id is
  'Internal n8n id of the paired WhatsApp Voice-Note sub-workflow. Never exposed to customers.';

-- 3. record_chat_conversation: upsert a conversation keyed on (tenant_id,
--    conversation_ref). Outcome advances but never downgrades a terminal result
--    (booked/managed/cancelled/abandoned win; quoted only fills unknown/null;
--    unknown only fills null). channel_id is resolved to the automation's channel
--    of the given type so per-channel analytics attribute correctly.
create or replace function public.record_chat_conversation(
  p_tenant          uuid,
  p_automation      uuid,
  p_conversation_ref text,
  p_customer_handle text,
  p_outcome         text    default 'unknown',
  p_channel         text    default 'whatsapp',
  p_customer_name   text    default null,
  p_started_at      timestamptz default null,
  p_via_voice       boolean default false,
  p_language        text    default 'en'
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id         uuid;
  v_channel_id uuid;
  v_outcome    text := coalesce(nullif(p_outcome, ''), 'unknown');
  v_started    timestamptz := coalesce(p_started_at, now());
begin
  if p_conversation_ref is null or p_conversation_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'missing conversation_ref');
  end if;
  if v_outcome not in ('booked','quoted','abandoned','managed','cancelled','unknown') then
    v_outcome := 'unknown';
  end if;

  -- Best-effort: attribute to the automation's channel of this type (e.g. the
  -- WhatsApp channel). Null when none is bound yet.
  select id into v_channel_id
    from public.channels
   where tenant_id = p_tenant and automation_id = p_automation and type = p_channel
   order by created_at asc
   limit 1;

  insert into public.conversations as c (
    tenant_id, automation_id, channel_id, conversation_ref,
    customer_handle, customer_name, language, started_at, outcome, via_voice
  ) values (
    p_tenant, p_automation, v_channel_id, p_conversation_ref,
    coalesce(nullif(p_customer_handle, ''), 'unknown'), p_customer_name,
    coalesce(nullif(p_language, ''), 'en'), v_started, v_outcome, coalesce(p_via_voice, false)
  )
  on conflict (tenant_id, conversation_ref) do update set
    outcome = case
      when excluded.outcome in ('booked','managed','cancelled','abandoned') then excluded.outcome
      when excluded.outcome = 'quoted' and (c.outcome is null or c.outcome = 'unknown') then 'quoted'
      else c.outcome
    end,
    customer_name = coalesce(excluded.customer_name, c.customer_name),
    channel_id    = coalesce(c.channel_id, excluded.channel_id),
    via_voice     = c.via_voice or excluded.via_voice,
    ended_at      = case
      when excluded.outcome in ('booked','managed','cancelled','abandoned') then now()
      else c.ended_at
    end
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'outcome',
    (select outcome from public.conversations where id = v_id));
end;
$$;

revoke all on function public.record_chat_conversation(
  uuid, uuid, text, text, text, text, text, timestamptz, boolean, text
) from anon, authenticated;
grant execute on function public.record_chat_conversation(
  uuid, uuid, text, text, text, text, text, timestamptz, boolean, text
) to service_role;

-- 4. record_chat_booking: upsert a confirmed/changed dispatch booking keyed on
--    (tenant_id, dispatch_ref). Detail fields are only overwritten when a
--    non-null value is supplied, so a cancel (ref + status only) preserves the
--    original trip. Links to its conversation via conversation_ref when known.
create or replace function public.record_chat_booking(
  p_tenant           uuid,
  p_automation       uuid,
  p_dispatch_ref     text,
  p_status           text    default 'booked',
  p_conversation_ref text    default null,
  p_channel_type     text    default 'whatsapp',
  p_dispatch_adapter text    default null,
  p_passenger_name   text    default null,
  p_customer_handle  text    default null,
  p_pickup           jsonb   default null,
  p_destination      jsonb   default null,
  p_vehicle_type     text    default null,
  p_passenger_count  integer default null,
  p_fare             numeric default null,
  p_currency         text    default 'GBP',
  p_pickup_at        timestamptz default null,
  p_pickup_time_mode text    default null,
  p_driver_note      text    default null,
  p_raw              jsonb   default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id      uuid;
  v_conv_id uuid;
  -- Map the bot's lifecycle word onto the bookings.status domain.
  v_status  text := case coalesce(nullif(p_status, ''), 'booked')
    when 'booked'    then 'confirmed'
    when 'modified'  then 'confirmed'
    when 'cancelled' then 'cancelled'
    when 'completed' then 'completed'
    when 'no_show'   then 'no_show'
    when 'confirmed' then 'confirmed'
    when 'dispatched' then 'dispatched'
    else 'confirmed'
  end;
begin
  if p_dispatch_ref is null or p_dispatch_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'missing dispatch_ref');
  end if;

  if p_conversation_ref is not null and p_conversation_ref <> '' then
    select id into v_conv_id from public.conversations
      where tenant_id = p_tenant and conversation_ref = p_conversation_ref
      limit 1;
  end if;

  insert into public.bookings as b (
    tenant_id, automation_id, conversation_id, channel_type, dispatch_ref,
    dispatch_adapter, passenger_name, customer_handle, pickup_address,
    destination_address, vehicle_type, passenger_count, fare, currency,
    pickup_at_utc, pickup_time_mode, driver_note, status, raw_dispatch_json
  ) values (
    p_tenant, p_automation, v_conv_id, p_channel_type, p_dispatch_ref,
    p_dispatch_adapter, p_passenger_name, p_customer_handle, p_pickup,
    p_destination, p_vehicle_type, p_passenger_count, p_fare, coalesce(p_currency, 'GBP'),
    p_pickup_at, p_pickup_time_mode, p_driver_note, v_status, p_raw
  )
  on conflict (tenant_id, dispatch_ref) where dispatch_ref is not null do update set
    status              = v_status,
    conversation_id     = coalesce(b.conversation_id,     excluded.conversation_id),
    dispatch_adapter    = coalesce(excluded.dispatch_adapter,    b.dispatch_adapter),
    passenger_name      = coalesce(excluded.passenger_name,      b.passenger_name),
    customer_handle     = coalesce(excluded.customer_handle,     b.customer_handle),
    pickup_address      = coalesce(excluded.pickup_address,      b.pickup_address),
    destination_address = coalesce(excluded.destination_address, b.destination_address),
    vehicle_type        = coalesce(excluded.vehicle_type,        b.vehicle_type),
    passenger_count     = coalesce(excluded.passenger_count,     b.passenger_count),
    fare                = coalesce(excluded.fare,                b.fare),
    currency            = coalesce(excluded.currency,            b.currency),
    pickup_at_utc       = coalesce(excluded.pickup_at_utc,       b.pickup_at_utc),
    pickup_time_mode    = coalesce(excluded.pickup_time_mode,    b.pickup_time_mode),
    driver_note         = coalesce(excluded.driver_note,         b.driver_note),
    raw_dispatch_json   = coalesce(excluded.raw_dispatch_json,   b.raw_dispatch_json),
    updated_at          = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

revoke all on function public.record_chat_booking(
  uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb, text,
  integer, numeric, text, timestamptz, text, text, jsonb
) from anon, authenticated;
grant execute on function public.record_chat_booking(
  uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb, text,
  integer, numeric, text, timestamptz, text, text, jsonb
) to service_role;
