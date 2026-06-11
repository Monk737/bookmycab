-- 0042: Make voice-credit top-up grants atomically idempotent.
--
-- The webhook grants credits on checkout.session.completed via a pre-insert
-- SELECT on stripe_payment_intent_id, which is not atomic. Two concurrent
-- deliveries of the same payment (under different Stripe event ids) could both
-- pass the SELECT and double-grant. A partial unique index closes the race at
-- the DB layer; the webhook treats a 23505 unique-violation as "already
-- granted". Scoped to topup_purchase rows (call_consumption rows have a null
-- payment intent, and admin_adjustment/refund may legitimately repeat).

create unique index credit_ledger_topup_pi_uniq
  on public.credit_ledger (stripe_payment_intent_id)
  where reason = 'topup_purchase';
