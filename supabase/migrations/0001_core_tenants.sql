-- Tenants (one per cab company)
create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique not null,
  country            text not null,
  plan_band          text not null check (plan_band in ('A-Single','A-Bundle','B-Single','B-Bundle','Custom')),
  currency           text not null check (currency in ('GBP','EUR','USD')),
  stripe_customer_id text,
  status             text not null default 'onboarding' check (status in ('onboarding','active','suspended','churned')),
  contract_start     date,
  contract_renewal   date,
  -- Q8 decision: roll to monthly after the 12-month term
  renewal_mode       text not null default 'rolling_monthly' check (renewal_mode in ('rolling_monthly','auto_12mo')),
  monthly_price      numeric(10,2),
  setup_fee_paid     boolean default false,
  is_demo            boolean default false,
  dispatch_adapter   text not null default 'autocab' check (dispatch_adapter in ('autocab','icabbi','cordic')),
  dispatch_company_id text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Users (linked to Supabase Auth)
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  is_demo_user  boolean default false,
  last_login_at timestamptz,
  created_at    timestamptz default now()
);

-- Tenant users (many-to-many with role)
create table public.tenant_users (
  tenant_id     uuid references public.tenants(id) on delete cascade,
  user_id       uuid references public.users(id) on delete cascade,
  role          text not null check (role in ('Owner','Admin','Viewer')),
  automation_restrictions uuid[] not null default '{}',  -- empty = all automations visible
  invited_by    uuid references public.users(id),
  invited_at    timestamptz default now(),
  accepted_at   timestamptz,
  primary key (tenant_id, user_id)
);

create index tenant_users_user_id_idx on public.tenant_users (user_id);
