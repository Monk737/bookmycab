-- 0046_two_product_drop_channel_mode.sql
--
-- Two-product pricing revamp. The platform now offers exactly two products
-- (Chat = WhatsApp Chat + Voice Note, AI Voice Booking) sold standalone or as a
-- Double Decker (Mix & Match) bundle. This migration retires the last of the
-- multi-channel / legacy A-B commercial model from the schema.

-- 1. Chat no longer has a single/bundle "channel mode".
ALTER TABLE public.chat_subscriptions DROP COLUMN IF EXISTS channel_mode;

-- 2. Align the demo tenant's bundled chat price to the new Double Decker
--    (Mix & Match) In Motion figure: £999 list − £200 bundle discount = £799.
UPDATE public.chat_subscriptions
   SET monthly_price_gbp = 799
 WHERE tenant_id = 'd0000000-0000-0000-0000-000000000001'
   AND plan_tier = 'in_motion';

-- 3. Drop the legacy tenants.plan_band column (and its CHECK). commercial_model
--    ('chat' | 'voice' | 'double_decker') is now the single source of truth for
--    a tenant's product; the A/B single/bundle band model is fully retired.
ALTER TABLE public.tenants DROP COLUMN IF EXISTS plan_band;

-- NOTE: the legacy tenant "Primier Mini Cab 2"
-- (7c1ed7bf-3dab-4dc9-8050-5b604232de92) was NOT hard-deleted here. It has rows
-- in the append-only `audit_log` (immutability trigger blocks DELETE) and the
-- audit_log -> tenants FK is NO ACTION, so a hard delete is intentionally
-- impossible while audit history exists. Soft-retire it instead (set
-- status = 'churned'), or assign it a commercial_model in the admin console.
