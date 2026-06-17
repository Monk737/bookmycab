-- 0069: mark automations paused by a billing lapse, so resume reactivates only
-- those (never an automation an admin deliberately stopped).
alter table public.automations
  add column if not exists billing_paused boolean not null default false;
