-- 0017: Feature entitlements & plan packaging.
--
-- Control plane for advanced features. A tenant's effective entitlements are
-- resolved server-side as: plan_features (by tenants.plan_id) → overlaid with
-- tenant_entitlements → gated by feature_rollouts (kill-switch/percentage).
-- Resolution lives in src/lib/entitlements, NOT in the JWT (avoids token bloat
-- and staleness when an admin changes a plan).

-- Plan catalog (global; FlowMo-managed). Coexists with the legacy
-- tenants.plan_band string; plan_id is the forward-looking pointer.
create table public.plans (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  name             text not null,
  description      text,
  base_price       numeric(10,2),
  currency         text not null default 'GBP' check (currency in ('GBP','EUR','USD')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Feature catalog (global). One row per gateable capability. `key` matches the
-- FeatureKey union in src/lib/entitlements/catalog.ts.
create table public.features (
  key         text primary key,
  name        text not null,
  description text,
  category    text not null,
  metered     boolean not null default false,
  unit        text,
  created_at  timestamptz not null default now()
);

-- Which features each plan includes + default quota.
create table public.plan_features (
  plan_id      uuid not null references public.plans(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  enabled      boolean not null default true,
  quota_limit  bigint,                                   -- null = unlimited
  quota_period text check (quota_period in ('day','month')),
  primary key (plan_id, feature_key)
);

-- Per-tenant overrides (admin-managed). Overlaid on top of the plan.
create table public.tenant_entitlements (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  enabled      boolean not null,
  quota_limit  bigint,
  quota_period text check (quota_period in ('day','month')),
  expires_at   timestamptz,
  set_by       uuid references public.users(id) on delete set null,
  note         text,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- Staged rollout / kill-switch (global).
create table public.feature_rollouts (
  feature_key text primary key references public.features(key) on delete cascade,
  strategy    text not null default 'all' check (strategy in ('all','percentage','allowlist','off')),
  percentage  int not null default 100 check (percentage between 0 and 100),
  allowlist   uuid[] not null default '{}',
  kill_switch boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.tenants add column plan_id uuid references public.plans(id);

-- Indexes
create index tenant_entitlements_tenant_idx on public.tenant_entitlements (tenant_id);
create index plan_features_plan_idx on public.plan_features (plan_id);

-- RLS ----------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.feature_rollouts enable row level security;

-- Global catalog tables hold no tenant data; any authenticated user may read
-- (the dashboard shows "your plan includes …"). Writes go through service_role,
-- which bypasses RLS, so no write policy is defined (default-deny for tenants).
create policy plans_select            on public.plans            for select using (true);
create policy features_select         on public.features         for select using (true);
create policy plan_features_select    on public.plan_features    for select using (true);
create policy feature_rollouts_select on public.feature_rollouts for select using (true);

-- A tenant may read its own overrides; only service_role writes.
create policy tenant_entitlements_select on public.tenant_entitlements
  for select using (tenant_id in (select public.current_user_tenants()));
