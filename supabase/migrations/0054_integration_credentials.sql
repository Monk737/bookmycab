-- 0054: per-tenant, per-product integration credential vault (admin console).
--
-- Stores the API keys, IDs and URLs BookMyCab admin holds for each tenant's
-- WhatsApp chatbot and AI Voice agent integrations. One row per individual
-- value, so a field can hold several values (e.g. multiple AutoCab API URLs)
-- and a tenant can have several instances of a product (e.g. two voice agents)
-- distinguished by instance_label.
--
-- Admin-only: RLS is enabled with NO policies, so anon/authenticated users
-- (including tenant users) can never read or write it. Only the service-role
-- client used by the admin server actions reaches it, the same boundary as
-- audit_log. Values are stored as text for the admin view/edit console.

create table if not exists public.integration_credentials (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  product       text not null check (product in ('whatsapp', 'voice')),
  instance_label text not null default 'Primary',
  field_key     text not null,
  field_value   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists integration_credentials_tenant_idx
  on public.integration_credentials (tenant_id, product, instance_label);

alter table public.integration_credentials enable row level security;

-- Keep updated_at fresh on edits.
create or replace function public.touch_integration_credentials()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists integration_credentials_touch on public.integration_credentials;
create trigger integration_credentials_touch
  before update on public.integration_credentials
  for each row execute function public.touch_integration_credentials();

revoke all on public.integration_credentials from anon, authenticated;
grant all on public.integration_credentials to service_role;
