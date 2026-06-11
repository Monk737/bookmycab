-- 0045_fix_jwt_role_claim.sql
--
-- BUG: custom_access_token_hook overwrote the reserved top-level `role` JWT
-- claim with the application role (Owner/Admin/Viewer). PostgREST reads that
-- claim as the Postgres role to assume for the request, so every RLS-bound
-- query from a tenant user failed with: role "Viewer" does not exist.
-- The dashboard data layer swallowed the error and rendered empty/zeroed state.
--
-- FIX: leave the incoming `role` claim untouched (Supabase sets it to
-- `authenticated`) and expose the application role under a NON-reserved claim,
-- `user_role`. App code reads `user_role` (with a `role` fallback for tokens
-- issued before this migration, until they refresh).

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
    -- Application role goes under user_role, NOT the reserved `role` claim,
    -- which PostgREST uses to choose the Postgres role (must stay authenticated).
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role));
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
