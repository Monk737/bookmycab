# Credential Rotation Runbook

All secrets live in the encrypted vault or the platform secret manager — never in
the repo or in plaintext env on a customer surface.

## When to rotate
- On a scheduled cadence (at least annually), on suspected compromise, or when an operator with access leaves.

## Channel credentials
- Regenerate the provider token (WhatsApp/Meta, Telegram, etc.) in the provider console.
- Update the vault entry via the admin console; the gateway picks up the new secret on next resolve (Redis cache TTL ≤ 5 min).
- Send a test inbound message to confirm signature verification still passes.

## Dispatch credentials
- Rotate the AutoCab subscription key (or iCabbi/Cordic secret) with the provider.
- Update the vaulted `autocab_subscription_key`; run a test quote + booking against the adapter.

## Vault key
- Rotating `SUPABASE_VAULT_KEY` is a coordinated operation: re-encrypt stored secrets under the new key, then roll the platform secret. Schedule a maintenance window and verify a booking end-to-end afterwards.
