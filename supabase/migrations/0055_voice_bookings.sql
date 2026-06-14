-- voice_bookings: dispatch bookings created/changed by the AI Voice agent,
-- mirrored from Autocab so the tenant dashboard can show live booking status.
-- Mirrors the `calls` table conventions: RLS on, tenant-scoped SELECT only,
-- writes performed exclusively through the SECURITY DEFINER record_voice_booking
-- RPC (called by the voice bookings ingest endpoint with the service role).

create table if not exists public.voice_bookings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id)     on delete cascade,
  automation_id     uuid not null references public.automations(id) on delete cascade,
  booking_ref       text not null,                       -- Autocab booking reference
  status            text not null default 'confirmed'
                      check (status in ('confirmed','cancelled','modified','completed','no_show')),
  provider_call_id  text,                                -- the Vapi call that created/changed it
  pickup            text,
  destination       text,
  pickup_time       text,                                -- UK local wall-clock as the agent passed it
  passenger_name    text,
  passengers        integer,
  bags              integer,
  vehicle_type      text,
  fare              text,                                -- e.g. "£74.50"
  caller_number     text,
  raw_dispatch_json jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  unique (tenant_id, booking_ref)
);

create index if not exists voice_bookings_tenant_automation_idx
  on public.voice_bookings (tenant_id, automation_id, created_at desc);

alter table public.voice_bookings enable row level security;

-- Tenant users can read their own bookings (same shape as calls_select).
drop policy if exists voice_bookings_select on public.voice_bookings;
create policy voice_bookings_select on public.voice_bookings
  for select using (tenant_id in (select current_user_tenants()));

-- updated_at touch trigger
create or replace function public.touch_voice_bookings() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_voice_bookings on public.voice_bookings;
create trigger trg_touch_voice_bookings
  before update on public.voice_bookings
  for each row execute function public.touch_voice_bookings();

-- Upsert RPC: one entry point for create / modify / cancel, keyed on
-- (tenant_id, booking_ref). Detail fields are only overwritten when a non-null
-- value is supplied, so a cancel (which sends just ref + status) preserves the
-- original trip details. SECURITY DEFINER + service_role only, like record_voice_call.
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

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end;
$$;

revoke all on function public.record_voice_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, text, text, jsonb
) from anon, authenticated;
grant execute on function public.record_voice_booking(
  uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, text, text, jsonb
) to service_role;
