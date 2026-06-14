-- Append-only event log for voice bookings. Every create/modify/cancel POST to
-- record_voice_booking writes one row here, so the dashboard can show the full
-- history (not just the collapsed current state in voice_bookings).
create table if not exists public.voice_booking_events (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id)     on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  booking_ref      text not null,
  action           text not null,         -- mirrors status at the time: confirmed/modified/cancelled/completed/no_show
  pickup           text,
  destination      text,
  pickup_time      text,
  passenger_name   text,
  passengers       integer,
  bags             integer,
  vehicle_type     text,
  fare             text,
  caller_number    text,
  provider_call_id text,
  occurred_at      timestamptz not null default now()
);

create index if not exists voice_booking_events_tenant_idx
  on public.voice_booking_events (tenant_id, automation_id, occurred_at desc);

alter table public.voice_booking_events enable row level security;

drop policy if exists voice_booking_events_select on public.voice_booking_events;
create policy voice_booking_events_select on public.voice_booking_events
  for select using (tenant_id in (select current_user_tenants()));

-- Extend the upsert RPC to also append an event row (pulled from the merged
-- voice_bookings row, so cancel/modify events still carry full trip details).
create or replace function public.record_voice_booking(
  p_tenant           uuid,
  p_automation       uuid,
  p_booking_ref      text,
  p_status           text    default 'confirmed',
  p_provider_call_id text    default null,
  p_pickup           text    default null,
  p_destination      text    default null,
  p_pickup_time      text    default null,
  p_passenger_name   text    default null,
  p_passengers       integer default null,
  p_bags             integer default null,
  p_vehicle_type     text    default null,
  p_fare             text    default null,
  p_caller_number    text    default null,
  p_raw              jsonb   default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id     uuid;
  v_status text := coalesce(nullif(p_status, ''), 'confirmed');
begin
  if p_booking_ref is null or p_booking_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'missing booking_ref');
  end if;

  insert into public.voice_bookings as vb (
    tenant_id, automation_id, booking_ref, status, provider_call_id,
    pickup, destination, pickup_time, passenger_name, passengers, bags,
    vehicle_type, fare, caller_number, raw_dispatch_json, cancelled_at
  ) values (
    p_tenant, p_automation, p_booking_ref, v_status, p_provider_call_id,
    p_pickup, p_destination, p_pickup_time, p_passenger_name, p_passengers, p_bags,
    p_vehicle_type, p_fare, p_caller_number, p_raw,
    case when v_status = 'cancelled' then now() else null end
  )
  on conflict (tenant_id, booking_ref) do update set
    status            = v_status,
    provider_call_id  = coalesce(excluded.provider_call_id,  vb.provider_call_id),
    pickup            = coalesce(excluded.pickup,            vb.pickup),
    destination       = coalesce(excluded.destination,       vb.destination),
    pickup_time       = coalesce(excluded.pickup_time,       vb.pickup_time),
    passenger_name    = coalesce(excluded.passenger_name,    vb.passenger_name),
    passengers        = coalesce(excluded.passengers,        vb.passengers),
    bags              = coalesce(excluded.bags,              vb.bags),
    vehicle_type      = coalesce(excluded.vehicle_type,      vb.vehicle_type),
    fare              = coalesce(excluded.fare,              vb.fare),
    caller_number     = coalesce(excluded.caller_number,     vb.caller_number),
    raw_dispatch_json = coalesce(excluded.raw_dispatch_json, vb.raw_dispatch_json),
    cancelled_at      = case when v_status = 'cancelled' then now() else vb.cancelled_at end,
    updated_at        = now()
  returning id into v_id;

  insert into public.voice_booking_events (
    tenant_id, automation_id, booking_ref, action,
    pickup, destination, pickup_time, passenger_name, passengers, bags,
    vehicle_type, fare, caller_number, provider_call_id
  )
  select tenant_id, automation_id, booking_ref, v_status,
         pickup, destination, pickup_time, passenger_name, passengers, bags,
         vehicle_type, fare, caller_number, p_provider_call_id
  from public.voice_bookings
  where id = v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

revoke all on function public.record_voice_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, text, text, jsonb
) from anon, authenticated;
grant execute on function public.record_voice_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, text, text, jsonb
) to service_role;
