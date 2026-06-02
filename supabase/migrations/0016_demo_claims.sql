-- supabase/migrations/0016_demo_claims.sql

-- Allow the custom_access_token_hook (supabase_auth_admin) to read
-- public.users.is_demo_user so it can inject the is_demo JWT claim.
grant select on public.users to supabase_auth_admin;

create policy users_authadmin_read on public.users
  as permissive for select to supabase_auth_admin
  using (true);

-- Replace the hook to also inject is_demo from public.users.is_demo_user.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user_id   uuid;
  v_email     text;
  v_claims    jsonb;
  v_tenant    uuid;
  v_role      text;
  v_restr     uuid[];
  v_is_demo   boolean;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims  := coalesce(event -> 'claims', '{}'::jsonb);
  v_email   := v_claims ->> 'email';

  -- v1: a user belongs to a single tenant; take the first membership.
  select tu.tenant_id, tu.role, tu.automation_restrictions
    into v_tenant, v_role, v_restr
  from public.tenant_users tu
  where tu.user_id = v_user_id
  order by tu.invited_at
  limit 1;

  if v_tenant is not null then
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant));
    v_claims := jsonb_set(v_claims, '{role}', to_jsonb(v_role));
    v_claims := jsonb_set(v_claims, '{automation_restrictions}', to_jsonb(coalesce(v_restr, '{}'::uuid[])));
  end if;

  -- FLOWMO_STAFF_EMAIL_DOMAIN = flowmoai.com
  v_claims := jsonb_set(
    v_claims, '{is_flowmo_staff}',
    to_jsonb(coalesce(v_email like '%@flowmoai.com', false))
  );

  -- Inject is_demo from public.users.is_demo_user (default false when row absent).
  select coalesce(is_demo_user, false)
    into v_is_demo
  from public.users
  where id = v_user_id;

  v_claims := jsonb_set(v_claims, '{is_demo}', to_json(coalesce(v_is_demo, false))::jsonb);

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;
