-- Add primary contact email to tenants.
-- Nullable so existing rows (provisioned before this column) remain valid.
alter table public.tenants add column contact_email text;

comment on column public.tenants.contact_email is
  'Primary contact email for onboarding and invite delivery (Task 4 "Send Invite").';
