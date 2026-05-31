-- Enable RLS on all tenant-scoped tables
alter table public.tenants         enable row level security;
alter table public.tenant_users    enable row level security;
alter table public.automations     enable row level security;
alter table public.channels        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.bookings        enable row level security;
alter table public.automation_runs enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.setup_fees      enable row level security;
alter table public.audit_log       enable row level security;

-- Helper: the set of tenant ids the current user belongs to.
create or replace function public.current_user_tenants()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_users where user_id = auth.uid();
$$;

-- Helper: automations the current user may see within a tenant,
-- honouring the Viewer automation_restrictions array ('{}' = all).
create or replace function public.user_can_see_automation(p_tenant uuid, p_automation uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_users tu
    where tu.user_id = auth.uid()
      and tu.tenant_id = p_tenant
      and (
        tu.automation_restrictions = '{}'
        or p_automation = any (tu.automation_restrictions)
      )
  );
$$;

-- tenants: a user sees tenants they belong to
create policy tenants_select on public.tenants
  for select using (id in (select public.current_user_tenants()));

-- tenant_users: a user sees membership rows of their own tenants
create policy tenant_users_select on public.tenant_users
  for select using (tenant_id in (select public.current_user_tenants()));

-- automations: SELECT honours the Viewer restriction; writes are tenant-scoped (per command, NOT for all)
create policy automations_select on public.automations
  for select using (public.user_can_see_automation(tenant_id, id));
create policy automations_insert on public.automations
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy automations_update on public.automations
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy automations_delete on public.automations
  for delete using (tenant_id in (select public.current_user_tenants()));

-- channels
create policy channels_select on public.channels
  for select using (public.user_can_see_automation(tenant_id, automation_id));
create policy channels_insert on public.channels
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy channels_update on public.channels
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy channels_delete on public.channels
  for delete using (tenant_id in (select public.current_user_tenants()));

-- conversations
create policy conversations_select on public.conversations
  for select using (public.user_can_see_automation(tenant_id, automation_id));
create policy conversations_insert on public.conversations
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy conversations_update on public.conversations
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy conversations_delete on public.conversations
  for delete using (tenant_id in (select public.current_user_tenants()));

-- messages: read inherits visibility from the parent conversation; writes go through service_role
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.user_can_see_automation(c.tenant_id, c.automation_id)
    )
  );

-- bookings
create policy bookings_select on public.bookings
  for select using (public.user_can_see_automation(tenant_id, automation_id));
create policy bookings_insert on public.bookings
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy bookings_update on public.bookings
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy bookings_delete on public.bookings
  for delete using (tenant_id in (select public.current_user_tenants()));

-- automation_runs: read inherits from the parent automation's tenant
create policy automation_runs_select on public.automation_runs
  for select using (
    exists (
      select 1 from public.automations a
      where a.id = automation_runs.automation_id
        and public.user_can_see_automation(a.tenant_id, a.id)
    )
  );

-- subscriptions / setup_fees: tenant read only
create policy subscriptions_select on public.subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy setup_fees_select on public.setup_fees
  for select using (tenant_id in (select public.current_user_tenants()));

-- audit_log: hard-deny for tenant users. RLS is enabled with NO permissive policy,
-- and table privileges are revoked from anon/authenticated so reads raise
-- "permission denied". service_role bypasses RLS and retains access.
revoke all on public.audit_log from anon, authenticated;
