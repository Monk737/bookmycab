-- 0026: Account invoicing & finance.
--
-- account_customers are corporate accounts a TENANT bills (distinct from the
-- FlowMo→tenant Stripe subscription). tenant_invoices are the invoices the
-- tenant issues to those accounts. commission_rates is FlowMo's cut (global).

create table public.account_customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  billing_email text,
  credit_terms  integer not null default 30,
  markup_pct    numeric(5,2) not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index account_customers_tenant_idx on public.account_customers (tenant_id);

create table public.tenant_invoices (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  account_customer_id uuid not null references public.account_customers(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  line_items         jsonb not null default '[]'::jsonb,
  subtotal           numeric(12,2) not null default 0,
  markup             numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  currency           text not null default 'GBP',
  status             text not null default 'draft' check (status in ('draft','issued','paid','void')),
  issued_at          timestamptz,
  created_at         timestamptz not null default now()
);
create index tenant_invoices_tenant_idx on public.tenant_invoices (tenant_id, created_at);

create table public.commission_rates (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  pct            numeric(5,2) not null,
  effective_from date not null default current_date
);

alter table public.bookings add column account_customer_id uuid references public.account_customers(id) on delete set null;
alter table public.bookings add column payment_status text;

-- RLS ----------------------------------------------------------------------
alter table public.account_customers enable row level security;
alter table public.tenant_invoices enable row level security;
alter table public.commission_rates enable row level security;

create policy account_customers_select on public.account_customers
  for select using (tenant_id in (select public.current_user_tenants()));
create policy account_customers_insert on public.account_customers
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy account_customers_update on public.account_customers
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy account_customers_delete on public.account_customers
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy tenant_invoices_select on public.tenant_invoices
  for select using (tenant_id in (select public.current_user_tenants()));
create policy tenant_invoices_insert on public.tenant_invoices
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy tenant_invoices_update on public.tenant_invoices
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- commission_rates: tenant may read its own (FlowMo's cut is visible); writes service_role.
create policy commission_rates_select on public.commission_rates
  for select using (tenant_id in (select public.current_user_tenants()));
