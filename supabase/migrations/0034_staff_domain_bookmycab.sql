-- 0034: Recognise @bookmycab.io as FlowMo staff (in addition to @flowmoai.com).
--
-- is_flowmo_staff is injected by custom_access_token_hook (0006, last redefined
-- in 0016). This widens the staff check so a @bookmycab.io address is also staff
-- — keeping the existing @flowmoai.com admins working (no lockout). Everything
-- else in the hook (tenant_id / role / automation_restrictions / is_demo) is
-- unchanged from 0016.

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

  -- Staff = @flowmoai.com OR @bookmycab.io
  v_claims := jsonb_set(
    v_claims, '{is_flowmo_staff}',
    to_jsonb(coalesce(v_email like '%@flowmoai.com' or v_email like '%@bookmycab.io', false))
  );

  select coalesce(is_demo_user, false)
    into v_is_demo
  from public.users
  where id = v_user_id;

  v_claims := jsonb_set(v_claims, '{is_demo}', to_json(coalesce(v_is_demo, false))::jsonb);

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;
