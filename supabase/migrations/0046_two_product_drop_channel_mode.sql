-- 0046_two_product_drop_channel_mode.sql
--
-- Two-product pricing revamp. The WhatsApp Chat + Voice Note product no longer
-- has a single/bundle "channel mode"; the platform now offers exactly two
-- products (Chat, AI Voice Booking) sold standalone or as a Double Decker
-- (Mix & Match) bundle. Drop the obsolete column and its CHECK.
--
-- The legacy tenants.plan_band column is intentionally KEPT (nullable) for
-- historical rows only. New tenants are provisioned with plan_band = null;
-- commercial_model ('chat' | 'voice' | 'double_decker') is the source of truth.

ALTER TABLE public.chat_subscriptions DROP COLUMN IF EXISTS channel_mode;

-- Align the demo tenant's bundled chat price to the new Double Decker
-- (Mix & Match) In Motion figure: £999 list − £200 bundle discount = £799.
UPDATE public.chat_subscriptions
   SET monthly_price_gbp = 799
 WHERE tenant_id = 'd0000000-0000-0000-0000-000000000001'
   AND plan_tier = 'in_motion';
