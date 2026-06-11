-- 0037: Credit ledger (prepaid AI Voice top-up balance, append-only).
--
-- Top-ups are app-managed prepaid credits (D5a): tenant buys via a one-off
-- Stripe payment; each call consumed from top-ups writes a -1 row (D5b, after
-- the plan pool is exhausted). Balance = SUM(delta). Top-ups never expire.

create table public.credit_ledger (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  delta                    integer not null,
  reason                   text not null check (reason in
                             ('topup_purchase','call_consumption','admin_adjustment','refund')),
  call_id                  uuid references public.calls(id) on delete set null,
  unit_price_micros        bigint,
  currency                 text check (currency in ('GBP','EUR','USD')),
  stripe_payment_intent_id text,
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now()
);
create index credit_ledger_tenant_idx on public.credit_ledger (tenant_id, created_at);

alter table public.credit_ledger enable row level security;
create policy credit_ledger_select on public.credit_ledger
  for select using (tenant_id in (select public.current_user_tenants()));

-- Append-only.
create or replace function public.prevent_credit_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only; UPDATE/DELETE is not permitted';
end;
$$;
create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row execute function public.prevent_credit_ledger_mutation();

-- Fast balance for the calling tenant; security definer so the dashboard reads
-- it directly, but gated to the caller's own tenants so it cannot read others'.
create or replace function public.credit_balance(p_tenant uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::bigint
  from public.credit_ledger
  where tenant_id = p_tenant
    and tenant_id in (select public.current_user_tenants());
$$;
