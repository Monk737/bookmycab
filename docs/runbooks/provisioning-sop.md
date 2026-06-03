# Tenant Provisioning SOP

How FlowMo staff take a signed customer from contract to live automation. Admin-only;
there is no public signup.

## Discovery
- Run the discovery call; capture fleet size, channels in use, and dispatch system (AutoCab / iCabbi / Cordic).
- Confirm pricing band and setup fee; issue the contract, DPA, and binding legal terms.

## Provision the tenant
- Create the tenant via the admin console (`/admin`); set `dispatch_adapter` and company id.
- Store channel + dispatch credentials in the vault (never in plaintext, never in env).
- Create the customer's automation(s); build the bespoke conversation flows in the Automation Engine.
- Invite the Owner via Supabase `invite()`; MFA is enforced for Owner/Admin.

## UAT
- Move the automation to `uat`; run the QA E2E suite (`pnpm test:e2e`) and a manual text + voice booking.
- Verify dispatch hand-off creates a real booking and the dashboard live feed updates.

## Go-live
- Flip the automation to `live`; start Stripe billing from the go-live date.
- Confirm webhook ACK p95 ≤ 300 ms on the status dashboard.
- Hand over the dashboard walkthrough; point the customer at `/status` and support.
