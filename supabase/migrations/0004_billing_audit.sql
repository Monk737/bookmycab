-- Subscriptions (Stripe <-> tenant)
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  stripe_sub_id        text unique not null,
  plan_band            text not null,
  monthly_price        numeric(10,2),
  currency             text,
  status               text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  contract_end         date,
  cancel_at            timestamptz
);
create index subscriptions_tenant_idx on public.subscriptions (tenant_id);

-- Setup fees
create table public.setup_fees (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  stripe_invoice_id text unique,
  amount            numeric(10,2),
  currency          text,
  paid_at           timestamptz
);
create index setup_fees_tenant_idx on public.setup_fees (tenant_id);

-- Audit log (immutable, append-only; bigserial ledger)
create table public.audit_log (
  id            bigserial primary key,
  tenant_id     uuid references public.tenants(id),
  actor_user_id uuid references public.users(id),
  action        text not null,
  target_type   text,
  target_id     text,
  metadata      jsonb,
  ip_address    inet,
  ts            timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id);
