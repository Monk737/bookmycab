-- 0021: Customer CRM + data governance.
--
-- A customer is one row per (tenant_id, customer_handle), derived from the
-- bookings/conversations the bot already writes. customer_notes are staff
-- annotations. bookings/conversations gain a nullable customer_id link.

create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  customer_handle   text not null,
  name              text,
  first_seen        timestamptz,
  last_seen         timestamptz,
  total_bookings    integer not null default 0,
  total_spend       numeric(12,2) not null default 0,
  preferred_vehicle text,
  vip               boolean not null default false,
  blocked           boolean not null default false,
  tags              text[] not null default '{}',
  updated_at        timestamptz not null default now(),
  unique (tenant_id, customer_handle)
);
create index customers_tenant_idx on public.customers (tenant_id);

create table public.customer_notes (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  author_id    uuid references public.users(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index customer_notes_customer_idx on public.customer_notes (customer_id);

alter table public.bookings add column customer_id uuid references public.customers(id) on delete set null;
alter table public.conversations add column customer_id uuid references public.customers(id) on delete set null;

-- RLS ----------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;

create policy customers_select on public.customers
  for select using (tenant_id in (select public.current_user_tenants()));
create policy customers_insert on public.customers
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy customers_update on public.customers
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy customers_delete on public.customers
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy customer_notes_select on public.customer_notes
  for select using (tenant_id in (select public.current_user_tenants()));
create policy customer_notes_insert on public.customer_notes
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy customer_notes_delete on public.customer_notes
  for delete using (tenant_id in (select public.current_user_tenants()));
