-- Distinguish booking-management calls (modify / cancel) from new bookings, so a
-- modify or cancel call is no longer mislabeled "booked" in the voice analytics.
-- The n8n end-of-call parser reclassifies the outcome from the booking tools
-- actually used on the call (cancel_booking -> cancelled, modify_booking ->
-- modified); these two values widen the allowed set.
alter table public.calls drop constraint if exists calls_outcome_check;
alter table public.calls add constraint calls_outcome_check
  check (outcome = any (array[
    'booked','modified','cancelled','quoted','abandoned','transferred','failed','no_credit','unknown'
  ]));
