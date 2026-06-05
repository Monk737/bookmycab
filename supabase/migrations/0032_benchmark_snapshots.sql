-- 0032: Network benchmarking (global, anonymised).
--
-- benchmark_snapshots holds p25/p50/p75 of a metric across opted-in tenants.
-- Global config — RLS enabled, no tenant policy (service-role only). A tenant
-- opt-in flag governs inclusion + (future) visibility of the comparison.

create table public.benchmark_snapshots (
  id           uuid primary key default gen_random_uuid(),
  metric       text not null,
  period_days  integer not null default 30,
  p25          numeric,
  p50          numeric,
  p75          numeric,
  sample_size  integer not null default 0,
  computed_at  timestamptz not null default now()
);
create index benchmark_snapshots_metric_idx on public.benchmark_snapshots (metric, computed_at);

alter table public.tenants add column benchmark_opt_in boolean not null default true;

alter table public.benchmark_snapshots enable row level security;
