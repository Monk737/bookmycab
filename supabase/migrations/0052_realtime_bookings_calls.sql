-- 0052: enable Supabase Realtime for bookings and calls.
--
-- The tenant dashboard notification bell subscribes to INSERT/UPDATE on these
-- tables. Realtime only broadcasts rows in the supabase_realtime publication,
-- and still enforces RLS per subscriber, so a tenant user receives only their
-- own tenant's rows. Idempotent: skip a table that is already published.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    execute 'alter publication supabase_realtime add table public.bookings';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calls'
  ) then
    execute 'alter publication supabase_realtime add table public.calls';
  end if;
end $$;
