-- 0038: voice_calls feature key.
--
-- Backs the SHARED plan call pool (D3/D4). Consumption is metered through the
-- existing usage_events (append-only) + usage_counters (per-period rollup)
-- tables with feature_key='voice_calls'. Per-plan quota_limit rows in
-- plan_features are seeded at provisioning time (R6/R7), not here.

insert into public.features (key, name, description, category, metered, unit)
values ('voice_calls', 'AI Voice calls',
        'Monthly included AI Voice call allowance (shared across a tenant''s voice agents).',
        'voice', true, 'call')
on conflict (key) do nothing;
