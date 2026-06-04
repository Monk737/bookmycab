-- 0019: Lock down entitlement catalog reads.
--
-- 0017 created plans/features/plan_features/feature_rollouts with
-- `select using (true)`, which the default PostgREST grants expose to the
-- anonymous role — leaking pricing/packaging and the rollout allowlist to the
-- public internet. The server-side resolver uses the service-role client (which
-- bypasses RLS), so restricting these to authenticated users (and rollouts to
-- service-role only) does not affect entitlement resolution.

-- Drop the permissive public-read policies.
drop policy if exists plans_select on public.plans;
drop policy if exists features_select on public.features;
drop policy if exists plan_features_select on public.plan_features;
drop policy if exists feature_rollouts_select on public.feature_rollouts;

-- Revoke the anon grant outright (defense in depth alongside RLS).
revoke select on public.plans from anon;
revoke select on public.features from anon;
revoke select on public.plan_features from anon;
revoke select on public.feature_rollouts from anon, authenticated;

-- Authenticated users may read the catalog (dashboards show "your plan includes …").
create policy plans_select on public.plans
  for select using (auth.uid() is not null);
create policy features_select on public.features
  for select using (auth.uid() is not null);
create policy plan_features_select on public.plan_features
  for select using (auth.uid() is not null);

-- feature_rollouts holds the staged allowlist/kill-switch state: service-role
-- only. RLS stays enabled with NO select policy (default-deny), matching the
-- audit_log approach in 0005.
