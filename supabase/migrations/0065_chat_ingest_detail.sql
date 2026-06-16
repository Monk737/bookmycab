-- 0065_chat_ingest_detail.sql
--
-- Enrich the WhatsApp Chatbot mirror so the tenant dashboard can show the FULL
-- booking card + a human summary for every action (booked / quoted / modified /
-- cancelled / failed), the way the bot's own WhatsApp card reads.
--
--  * conversations.summary / bookings.summary: the bot's actual reply card text
--    (Parse_Booking / Parse_Quote / cancel / modify), stored verbatim so the
--    dashboard drawer shows "exactly what the customer saw".
--  * 'failed' added to the conversation outcome domain (a booking attempt that
--    AutoCab rejected → handoff).
--  * record_chat_conversation / record_chat_booking gain p_summary; the
--    conversation RPC also handles the 'failed' outcome (failed/booked/managed/
--    cancelled are terminal and win; quoted/abandoned only fill unknown/null).

alter table public.conversations add column if not exists summary text;
alter table public.bookings      add column if not exists summary text;

alter table public.conversations drop constraint if exists conversations_outcome_check;
alter table public.conversations add constraint conversations_outcome_check
  check (outcome in ('booked','quoted','abandoned','managed','cancelled','failed','unknown'));

-- record_chat_conversation: + p_summary, + 'failed'. Drop the 0064 signature first
-- (appending an argument changes the signature, so CREATE OR REPLACE won't do).
drop function if exists public.record_chat_conversation(
  uuid, uuid, text, text, text, text, text, timestamptz, boolean, text
);

create function public.record_chat_conversation(
  p_tenant          uuid,
  p_automation      uuid,
  p_conversation_ref text,
  p_customer_handle text,
  p_outcome         text    default 'unknown',
  p_channel         text    default 'whatsapp',
  p_customer_name   text    default null,
  p_started_at      timestamptz default null,
  p_via_voice       boolean default false,
  p_language        text    default 'en',
  p_summary         text    default null
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
  if v_outcome not in ('booked','quoted','abandoned','managed','cancelled','failed','unknown') then
    v_outcome := 'unknown';
  end if;

  select id into v_channel_id
    from public.channels
   where tenant_id = p_tenant and automation_id = p_automation and type = p_channel
   order by created_at asc
   limit 1;

  insert into public.conversations as c (
    tenant_id, automation_id, channel_id, conversation_ref,
    customer_handle, customer_name, language, started_at, outcome, via_voice, summary
  ) values (
    p_tenant, p_automation, v_channel_id, p_conversation_ref,
    coalesce(nullif(p_customer_handle, ''), 'unknown'), p_customer_name,
    coalesce(nullif(p_language, ''), 'en'), v_started, v_outcome, coalesce(p_via_voice, false), p_summary
  )
  on conflict (tenant_id, conversation_ref) do update set
    outcome = case
      when excluded.outcome in ('booked','managed','cancelled','failed') then excluded.outcome
      when excluded.outcome in ('quoted','abandoned') and (c.outcome is null or c.outcome = 'unknown') then excluded.outcome
      else c.outcome
    end,
    customer_name = coalesce(excluded.customer_name, c.customer_name),
    channel_id    = coalesce(c.channel_id, excluded.channel_id),
    via_voice     = c.via_voice or excluded.via_voice,
    -- Keep the summary in step with whichever outcome is now in effect: refresh
    -- it when this event sets/keeps the outcome, never blank an existing one.
    summary       = case
      when excluded.outcome in ('booked','managed','cancelled','failed') then coalesce(excluded.summary, c.summary)
      when excluded.outcome in ('quoted','abandoned') and (c.outcome is null or c.outcome = 'unknown') then coalesce(excluded.summary, c.summary)
      else coalesce(c.summary, excluded.summary)
    end,
    ended_at      = case
      when excluded.outcome in ('booked','managed','cancelled','failed','abandoned') then now()
      else c.ended_at
    end
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'outcome',
    (select outcome from public.conversations where id = v_id));
end;
$$;

revoke all on function public.record_chat_conversation(
  uuid, uuid, text, text, text, text, text, timestamptz, boolean, text, text
) from anon, authenticated;
grant execute on function public.record_chat_conversation(
  uuid, uuid, text, text, text, text, text, timestamptz, boolean, text, text
) to service_role;

-- record_chat_booking: + p_summary (the booking card text). Drop the 0064 sig first.
drop function if exists public.record_chat_booking(
  uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb, text,
  integer, numeric, text, timestamptz, text, text, jsonb
);

create function public.record_chat_booking(
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
  p_raw              jsonb   default null,
  p_summary          text    default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id      uuid;
  v_conv_id uuid;
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
    pickup_at_utc, pickup_time_mode, driver_note, status, raw_dispatch_json, summary
  ) values (
    p_tenant, p_automation, v_conv_id, p_channel_type, p_dispatch_ref,
    p_dispatch_adapter, p_passenger_name, p_customer_handle, p_pickup,
    p_destination, p_vehicle_type, p_passenger_count, p_fare, coalesce(p_currency, 'GBP'),
    p_pickup_at, p_pickup_time_mode, p_driver_note, v_status, p_raw, p_summary
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
    summary             = coalesce(excluded.summary,             b.summary),
    updated_at          = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

revoke all on function public.record_chat_booking(
  uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb, text,
  integer, numeric, text, timestamptz, text, text, jsonb, text
) from anon, authenticated;
grant execute on function public.record_chat_booking(
  uuid, uuid, text, text, text, text, text, text, text, jsonb, jsonb, text,
  integer, numeric, text, timestamptz, text, text, jsonb, text
) to service_role;
