# Epic 3 — Internal Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute with `superpowers:subagent-driven-development` (implementer → spec review → quality review per task). **All admin UI MUST use the `ui-ux-pro-max` skill** (roadmap mandate). Steps use `- [ ]` checkboxes.

**Goal:** Ship the FlowMo-staff-only Internal Admin Console at `/admin` — the operational backbone that provisions tenants, tracks the bespoke build pipeline, manages channel credentials, surfaces billing/renewals, and supports read-only impersonation. Per the roadmap, **the admin console is built before the tenant dashboard** (nothing can exist without admin provisioning first).

**What already exists (do NOT rebuild):**
- **Auth (Epic 4):** middleware already gates `/admin` and `/admin/*` on `is_flowmo_staff` (`src/middleware/access.ts` → `evaluateAccess`); MFA gate runs first so staff hit `/mfa` at aal1. Reusable helpers in `@/lib/auth/session`: `requireUser()`, `getCurrentClaims()`, `redirectTargetFor()` (staff → `/admin`). Auth UI primitives in `src/components/auth/` (AuthCard/Field/SubmitButton/ButtonLink).
- **DB (Epic 1):** `tenants` (name, slug, country, plan_band A-Single/A-Bundle/B-Single/B-Bundle/Custom, currency, stripe_customer_id, status onboarding/active/suspended/churned, contract_start, contract_renewal, renewal_mode, monthly_price, setup_fee_paid, is_demo, dispatch_adapter, dispatch_company_id), `users`, `tenant_users` (role, automation_restrictions, invited_by/at, accepted_at), `automations` (name, type, engine_workflow_id, engine_project_id, status building/uat/live/stopped/error, dispatch_adapter), `channels` (type, webhook_path, credentials_ref, status, token_expires_at), `subscriptions` (stripe_sub_id, plan_band, monthly_price, currency, status, periods, contract_end), `setup_fees` (stripe_invoice_id, amount, paid_at), `audit_log` (append-only bigserial: tenant_id, actor_user_id, action, target_type, target_id, metadata jsonb, ip_address, ts — **RLS: tenant users hard-denied; only service_role reads**).
- Supabase clients: `@/lib/supabase/server` `createClient()` (SSR, RLS as the user), service-role pattern used in `(auth)/actions.ts` (construct `@supabase/supabase-js` client with `env.SUPABASE_SERVICE_ROLE_KEY` for privileged ops).

**Critical dependency reality — Epic 5 (n8n engine) and Epic 8 (Stripe billing) are NOT built yet.** This plan does NOT call n8n or Stripe live. Instead:
- **Engine:** "Open in Automation Engine" is an internal deeplink built from `engine_workflow_id`/`engine_project_id` + `env.N8N_BASE_URL` — staff-only, never surfaced to tenants. No control calls (start/stop/status are Epic 5).
- **Stripe:** the Stripe panel reads **local** `subscriptions`/`setup_fees`/`tenants` tables (Epic 8 populates them via webhooks later). MRR/ARR/renewal alerts/setup-fee pipeline are **computed from local data**. "Open in Stripe" is a dashboard deeplink (`https://dashboard.stripe.com/customers/{stripe_customer_id}`). "Manual sync" is **stubbed** with a clear "Stripe sync available after Epic 8" state — do NOT call the Stripe API.
- Mark every such seam with a `// TODO(epic-5)` / `// TODO(epic-8)` comment so the live wiring is greppable.

**Architecture:** Admin pages live under `src/app/admin/` (server components by default). Admin mutations run through **server actions** in `src/app/admin/actions.ts` (and per-feature action files) using the **service-role client** — admin operates across all tenants, which RLS would otherwise block; every privileged action is **audit-logged** to `audit_log`. A thin server-side `requireStaff()` guard (defense-in-depth on top of middleware) protects every admin page and action. Admin-specific UI primitives live in `src/components/admin/` (built with `ui-ux-pro-max` — a denser, operational console aesthetic distinct from both marketing and product-auth). Pure logic (MRR/ARR math, renewal-window bucketing, plan-band pricing, slug generation, impersonation-token validity) lives in testable `src/lib/admin/*` modules with Vitest unit tests. Two new migrations add build-queue fields and the credentials vault.

**Tech Stack:** Next.js 15 server actions · `@supabase/ssr` + service-role `@supabase/supabase-js` · Supabase Vault / `pgcrypto` · React 19 · Tailwind v4 · recharts (platform analytics) · Vitest + Testing Library/jsdom + `pg` (RLS/migration tests) · zod.

**Spec sources:** PRD §5.4 (admin capabilities), §9.2 (admin-driven onboarding flow), §9.4.1–9.4.7 (tenant mgmt, automation registry, build queue Kanban, credentials vault, Stripe panel, impersonation, platform analytics), §12.12 (Admin API routes), §10 (Supabase Vault for credentials, audit logging). §8.2 (RLS).

**Locked decisions for this epic:**
- **Staff identity:** `is_flowmo_staff = true` in JWT (set by the Epic 1 custom-access-token hook). The console never trusts client state — `requireStaff()` re-checks claims server-side on every page/action.
- **All admin writes are audit-logged** to `audit_log` (actor = staff user, action verb, target_type/id, metadata). This is non-negotiable per §10.
- **Impersonation is read-only**, requires a **mandatory reason**, **auto-expires after 15 minutes**, shows a persistent banner, and is fully audit-logged (start + end). No write actions possible while impersonating. (Q-decision: impersonation issues a **scoped, time-boxed impersonation token/record** — it does NOT mint a real tenant session; the tenant dashboard is Epic 7, so this epic delivers the impersonation *mechanism* + audit + banner, validated by unit tests; the actual "view-as" rendering hooks in when Epic 7 lands.)
- **Build queue stages:** `Requested → Scoped → Building → UAT → Live` (distinct from `automations.status`). Stage transitions are audit-logged; the per-stage tenant email (§9.4.3) is **deferred to Epic 8/Resend** — fire a `// TODO(resend)` no-op + audit entry now.
- **Credentials vault:** store channel credentials encrypted via `pgcrypto` (Supabase Vault pattern); the vault read/rotate is **senior-ops** only and **every access is audit-logged**; raw values never appear in any list response or log. (Q9 n8n editor deeplink: staff-only, gated in the registry.)
- **No new public surface.** Everything is under `/admin` (already staff-gated). The marketing/auth no-signup guards stay green.

**Prerequisites:** Epics 1, 2, 4 merged to `master` (they are). Build on branch `epic-3-admin` (create off `master`). Local Supabase via colima for migration/RLS tests. **Run `pnpm test`/vitest + `supabase` with `dangerouslyDisableSandbox: true`** (sandbox hangs binaries; subagents run unsandboxed).

---

## File structure (created/modified by this epic)

```
supabase/migrations/
  0007_build_queue_fields.sql         # automations: + build_stage, assigned_engineer, target_go_live, build_notes
  0008_credentials_vault.sql          # pgcrypto vault for channel credentials + audit trigger
src/
  lib/admin/
    guard.ts                          # requireStaff() server guard
    audit.ts                          # writeAudit(action, target, metadata) helper (service-role)
    billing-math.ts                   # pure: MRR, ARR, renewal-window buckets, setup-fee pipeline
    plan-bands.ts                     # pure: plan band ↔ price/label, slug generation
    impersonation.ts                  # pure: token mint/validate, 15-min expiry logic
    engine-links.ts                   # pure: build internal n8n deeplink from ids (no calls)
  components/admin/
    admin-shell.tsx                   # sidebar nav + staff badge + sign-out
    data-table.tsx, stat-card.tsx, status-badge.tsx, kanban-board.tsx, ...  (ui-ux-pro-max)
  app/admin/
    layout.tsx                        # requireStaff() + <AdminShell>
    page.tsx                          # admin home / platform analytics overview
    actions.ts                        # shared admin server actions (audit, impersonate)
    tenants/page.tsx                  # list
    tenants/new/page.tsx              # provisioning form (+ actions)
    tenants/[tenantId]/page.tsx       # detail: automations, users, channels, invoices, audit
    tenants/[tenantId]/actions.ts     # create/edit/suspend/reinstate/churn/send-invite
    automations/page.tsx              # global registry + engine deeplink
    build-queue/page.tsx              # Kanban + stage transitions
    credentials/page.tsx              # vault list + add/rotate (senior-ops, audited)
    billing/page.tsx                  # Stripe panel (local data) + renewal alerts
    impersonate/page.tsx              # search + start (reason) + banner
tests/
  admin-billing-math.test.ts          # MRR/ARR/renewal buckets/setup pipeline
  admin-plan-bands.test.ts            # band↔price, slug
  admin-impersonation.test.ts         # token mint/validate/expiry
  admin-guard.test.ts                 # requireStaff redirect/allow (pure-ish)
  admin-structure.test.ts             # all admin routes staff-gated; no admin route in PUBLIC_PAGES
  admin-rls.test.ts                   # migration 0007/0008 apply; vault encrypts; audit append-only holds
  admin-forms.test.tsx                # jsdom: provisioning form + impersonation reason gate
```

**Responsibility boundaries:** pure math/logic in `lib/admin/*` is node-unit-tested; migrations + vault encryption + audit-append-only are `pg`-tested against local Supabase; forms are `ui-ux-pro-max` + jsdom behavior-tested; live n8n/Stripe calls are explicitly OUT (Epics 5/8). Each task ends green on `pnpm test` + `pnpm typecheck` + `pnpm build` + `pnpm lint`.

---

## Task 1: Schema — build-queue fields + credentials vault (migrations, TDD)

**Files:** Create `supabase/migrations/0007_build_queue_fields.sql`, `supabase/migrations/0008_credentials_vault.sql`, `tests/admin-rls.test.ts`. Read the Epic 1 plan's "AS-BUILT CORRECTIONS" header first and the existing `tests/rls.test.ts`/`tests/helpers/db.ts` for the `pg`-test harness.

- [ ] **Step 1: Write the migration test first (TDD).** `tests/admin-rls.test.ts` (uses the `pg` harness against local Supabase :54322): assert after migration that `automations` has `build_stage` (check constraint `Requested|Scoped|Building|UAT|Live`, default `Requested`), `assigned_engineer` (uuid → users), `target_go_live` (date), `build_notes` (text); assert the credentials vault table exists, that an inserted credential's raw value is NOT readable as plaintext (encrypted column), and that `audit_log` remains append-only (UPDATE/DELETE by service_role still blocked per existing trigger/grant — verify the existing guarantee holds).
- [ ] **Step 2: `0007_build_queue_fields.sql`** — `alter table public.automations add column build_stage text not null default 'Requested' check (build_stage in ('Requested','Scoped','Building','UAT','Live')), add column assigned_engineer uuid references public.users(id), add column target_go_live date, add column build_notes text;`. (Keep `status` as-is — runtime/health is separate from pipeline stage.)
- [ ] **Step 3: `0008_credentials_vault.sql`** — enable `pgcrypto`; create `public.channel_credentials` (id, tenant_id, channel_id → channels, credential_type, `secret_encrypted bytea` via `pgcrypto` symmetric encryption keyed from a vault secret, created_by, created_at, last_accessed_at, last_accessed_by). RLS: enable, **no permissive policy** for anon/authenticated (mirror `audit_log` hard-deny); only service_role reads/writes. Provide SQL helper functions `vault_store_credential(...)` and `vault_read_credential(...)` (security definer) so the app never handles the encryption key directly. Document the key source (env/Supabase Vault) — do not hardcode a key.
- [ ] **Step 4: Verify** migrations apply cleanly on a fresh local DB (`supabase db reset` or the project's migration-apply path); `tests/admin-rls.test.ts` green; existing `tests/rls.test.ts` still green.
- [ ] **Step 5: Commit** — `feat(admin): build-queue fields + pgcrypto credentials vault`

---

## Task 2: Staff guard + audit helper + admin shell

**Use `ui-ux-pro-max`** for the admin shell (operational console aesthetic: persistent left sidebar, dense, neutral, staff badge — distinct from marketing/auth).

**Files:** Create `src/lib/admin/guard.ts`, `src/lib/admin/audit.ts`, `src/components/admin/admin-shell.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx` (placeholder home), `tests/admin-guard.test.ts`. Modify `tests/admin-structure.test.ts` (create).

- [ ] **Step 1: `requireStaff()` (TDD where pure-able).** `src/lib/admin/guard.ts`: `requireStaff()` reads `getCurrentClaims()`; if no claims → `redirect("/login")`; if `!claims.is_flowmo_staff` → `redirect("/dashboard")`; else returns claims. Extract any pure decision into a testable function (`staffAccessDecision(claims)`) and unit-test it in `tests/admin-guard.test.ts`.
- [ ] **Step 2: `writeAudit()` helper.** `src/lib/admin/audit.ts`: `writeAudit({ actorUserId, tenantId?, action, targetType?, targetId?, metadata? })` inserts into `audit_log` via the service-role client. Centralizes the audit contract for all admin actions. (Capture `ip_address` if easily available from headers; otherwise null.)
- [ ] **Step 3: Admin shell + layout.** `admin-shell.tsx`: left sidebar (Overview, Tenants, Automations, Build Queue, Credentials, Billing, Impersonate), FlowMo staff badge, sign-out (reuse `(auth)/actions.ts` `signOut`). `app/admin/layout.tsx`: `await requireStaff()` then wrap children in `<AdminShell>`. `app/admin/page.tsx`: minimal overview placeholder (real analytics in Task 8).
- [ ] **Step 4: Structure guard.** `tests/admin-structure.test.ts`: assert no `/admin*` path is in `PUBLIC_PAGES`; assert `evaluateAccess("/admin", staffClaims_aal2)` allows and `evaluateAccess("/admin", nonStaffClaims_aal2)` redirects to `/dashboard`; assert each admin page file exists as it's added (start with layout + page).
- [ ] **Step 5: Verify** test/typecheck/build/lint green. **Commit** — `feat(admin): staff guard, audit helper, admin shell`

---

## Task 3: Tenant provisioning (list + create) + audit

**Use `ui-ux-pro-max`.** Spec: §9.2 step 4, §9.4.1 create-tenant fields.

**Files:** Create `src/lib/admin/plan-bands.ts`, `tests/admin-plan-bands.test.ts`, `src/app/admin/tenants/page.tsx`, `src/app/admin/tenants/new/page.tsx` (+ form), `src/app/admin/tenants/actions.ts`, `src/components/admin/{data-table,stat-card,status-badge}.tsx`, `tests/admin-forms.test.tsx`.

- [ ] **Step 1: `plan-bands.ts` (pure, TDD).** Plan-band ↔ monthly price/label map (reuse Epic 2 `lib/marketing/pricing` values where they align: A-Single/A-Bundle/B-Single/B-Bundle/Custom across GBP/EUR/USD), and `slugify(name)` for the tenant slug. Unit-test in `tests/admin-plan-bands.test.ts`.
- [ ] **Step 2: Tenants list** — `tenants/page.tsx`: server component, service-role read of all tenants; `<DataTable>` columns per §9.4.1 (name, status, plan_band, dispatch_adapter, monthly_price/MRR, contract_renewal, last login). Link rows to detail (Task 4). "New tenant" CTA.
- [ ] **Step 3: Provisioning form** — `tenants/new/page.tsx` + client form: org name, slug (auto from name, editable), country, plan_band, currency, dispatch_adapter + dispatch_company_id, primary contact email, contract_start, monthly_price, stripe_customer_id (optional — Epic 8), setup_fee amount (optional). zod-validate; `createTenant` server action (service-role insert into `tenants`; **audit-log** the creation; on success redirect to the new tenant detail).
- [ ] **Step 4: Form behavior test** — `tests/admin-forms.test.tsx`: provisioning form renders required fields, validates, calls `createTenant` (mocked). Real DOM assertions.
- [ ] **Step 5: Verify** + **Commit** — `feat(admin): tenant provisioning list + create form`

---

## Task 4: Tenant detail + lifecycle actions + Supabase invite

**Use `ui-ux-pro-max`.** Spec: §9.2 step 5 (Send Invite), §9.4.1 (detail, suspend/reinstate/churn/edit).

**Files:** Create `src/app/admin/tenants/[tenantId]/page.tsx`, `src/app/admin/tenants/[tenantId]/actions.ts`. Modify `tests/admin-forms.test.tsx`.

- [ ] **Step 1: Tenant detail** — server component: tenant header + edit-contract affordance; sections for automations, users (tenant_users + role), channels, invoices (subscriptions/setup_fees — local), and **that tenant's audit log** (service-role read, since tenant users are hard-denied). Reuse `<DataTable>`/`<StatusBadge>`.
- [ ] **Step 2: Lifecycle actions** (`actions.ts`, service-role + audit each): `editContract` (dates/price/renewal_mode), `suspendTenant`/`reinstateTenant`/`markChurned` (set `tenants.status`), each audit-logged.
- [ ] **Step 3: Send Invite** — `sendInvite(tenantId, email, role)` uses Supabase Auth admin `inviteUserByEmail` (service-role `auth.admin`), creates/links the `users` + `tenant_users` row (role, invited_by, invited_at), redirect lands the invitee at `/accept-invite` (Epic 4 already handles acceptance). Audit-log the invite. **TODO(resend):** custom email templating is later; Supabase's invite email is fine now.
- [ ] **Step 4: Tests** — extend `admin-forms.test.tsx`: invite form validates email+role and calls `sendInvite`; a lifecycle action (e.g. suspend) calls its action. Mocked.
- [ ] **Step 5: Verify** + **Commit** — `feat(admin): tenant detail, lifecycle actions, Supabase invite`

---

## Task 5: Automation registry + build queue (Kanban)

**Use `ui-ux-pro-max`.** Spec: §9.4.2 (registry + engine deeplink), §9.4.3 (Kanban Requested→Scoped→Building→UAT→Live).

**Files:** Create `src/lib/admin/engine-links.ts`, `src/app/admin/automations/page.tsx`, `src/app/admin/build-queue/page.tsx` (+ actions), `src/components/admin/kanban-board.tsx`, `tests/admin-engine-links.test.ts`.

- [ ] **Step 1: `engine-links.ts` (pure, TDD).** `buildEngineDeeplink(env.N8N_BASE_URL, engine_project_id, engine_workflow_id)` → internal URL string (no network call). Returns null when ids/base are absent. Unit-test. **Never** exposed in any tenant-facing surface.
- [ ] **Step 2: Automation registry** — global list across all tenants (service-role): tenant name, automation name, type, status, dispatch_adapter, engine_workflow_id (internal), last run (N/A until Epic 5 — show "—"), assigned_engineer. Status filter. "Open in Automation Engine" deeplink (staff-only). `// TODO(epic-5)` for live status/last-run.
- [ ] **Step 3: Build queue Kanban** — `kanban-board.tsx`: five columns by `build_stage`; each card = tenant, automation, type, assigned_engineer, target_go_live, build_notes. Stage-change action (`setBuildStage`) updates `automations.build_stage`, audit-logs the transition, and fires a `// TODO(resend)` no-op stage-email hook. "Go Live" on UAT → sets `build_stage='Live'` AND `status='live'` (audit-logged). (Drag-and-drop optional; buttons/select acceptable — keep it server-action driven and testable.)
- [ ] **Step 4: Verify** + **Commit** — `feat(admin): automation registry + build queue kanban`

---

## Task 6: Channel credentials vault (senior-ops, audited)

**Use `ui-ux-pro-max`.** Spec: §9.4.4, §10 (pgcrypto, raw values never shown, every access audit-logged).

**Files:** Create `src/app/admin/credentials/page.tsx` (+ actions). Uses the Task 1 vault.

- [ ] **Step 1: Vault list** — by tenant + channel type; show credential_type, created_at, last_accessed_at, token-expiry warning (from `channels.token_expires_at`). **Never** render raw secret values in the list.
- [ ] **Step 2: Add credential** — form → `vault_store_credential` (service-role calls the security-definer SQL fn); audit-log (action `credential.add`, no secret in metadata).
- [ ] **Step 3: View/rotate (senior-ops)** — reveal/rotate is a deliberate, audited action: `vault_read_credential`/rotate via the SQL fn; **every access audit-logged** (action `credential.view`/`credential.rotate`). Gate behind a senior-ops check (claims-based; if no finer role exists yet, gate on `is_flowmo_staff` + a `// TODO` to refine when a senior-ops role lands). Raw value shown transiently in the UI only, never logged.
- [ ] **Step 4: Verify** (incl. a test asserting no raw secret appears in list responses / audit metadata) + **Commit** — `feat(admin): channel credentials vault with audited access`

---

## Task 7: Stripe panel + renewal alerts (local data; no live Stripe)

**Use `ui-ux-pro-max`.** Spec: §9.4.5. **Epic 8 not built — read local tables only.**

**Files:** Create `src/lib/admin/billing-math.ts`, `tests/admin-billing-math.test.ts`, `src/app/admin/billing/page.tsx`.

- [ ] **Step 1: `billing-math.ts` (pure, TDD).** From local `tenants`/`subscriptions`: `computeMRR(tenants)`, `computeARR`, MRR by plan band, `renewalBuckets(tenants, today)` → contracts renewing in 7/14/30/60/90 days (PRD alerts at 60/30/14/7), `setupFeePipeline(setup_fees)` → outstanding unpaid. Cover currency handling (don't sum mixed currencies blindly — group by currency or normalize per documented assumption). Thorough unit tests with fixed `today`.
- [ ] **Step 2: Stripe panel** — summary stat cards (MRR, ARR, active contracts, renewing-in-30); renewal alert table (tenant, renewal date, plan, MRR, sorted soonest); setup-fee pipeline. "Open in Stripe" deeplink per tenant (`dashboard.stripe.com/customers/{stripe_customer_id}`). "Manual sync" button → disabled/"available after Epic 8" state with `// TODO(epic-8)`. recharts for MRR-by-band if useful.
- [ ] **Step 3: Verify** + **Commit** — `feat(admin): billing panel + renewal alerts (local data)`

---

## Task 8: Impersonation + platform analytics + final pass

**Use `ui-ux-pro-max`.** Spec: §9.4.6 (impersonation), §9.4.7 (platform analytics).

**Files:** Create `src/lib/admin/impersonation.ts`, `tests/admin-impersonation.test.ts`, `src/app/admin/impersonate/page.tsx` (+ action), update `src/app/admin/page.tsx` (platform analytics), `tests/admin-structure.test.ts` (finalize). Modify `src/app/admin/actions.ts`.

- [ ] **Step 1: `impersonation.ts` (pure, TDD).** `mintImpersonation({ staffUserId, tenantId, targetUserId, reason, now })` → a record with `expires_at = now + 15min`; `isImpersonationValid(record, now)` → false once expired; reason is **mandatory** (empty → throws/invalid). Unit-test mint + 15-min expiry + reason requirement + read-only invariant (the record carries `mode: "read_only"`).
- [ ] **Step 2: Impersonation UI + action** — search by tenant/user email; "Impersonate" requires a **mandatory reason** before starting; `startImpersonation` action **audit-logs** start (action `impersonate.start`, metadata reason+target) and creates the impersonation record; persistent banner component shown while active; auto-expiry after 15 min; **no write actions** during impersonation. (The actual tenant "view-as" rendering binds in Epic 7 — this task delivers the audited, time-boxed mechanism + banner + guards, proven by unit tests; add a `// TODO(epic-7)` where the view-as session would attach.)
- [ ] **Step 3: Platform analytics** (`admin/page.tsx`) — MRR/ARR (reuse `billing-math`), new contracts MTD/YTD, contracts ending 30/60/90 (churn risk table), active automations by type, gross bookings volume (aggregate count from `bookings` — may be 0 until later epics; show real count), top tenants by MRR, setup-fee pipeline. recharts where it reads well.
- [ ] **Step 4: Finalize structure guard** — `tests/admin-structure.test.ts`: every admin route file exists; none in `PUBLIC_PAGES`; non-staff is redirected from each; impersonation requires reason (assert the action rejects empty reason).
- [ ] **Step 5: Full verification** — `pnpm lint && pnpm typecheck && pnpm build && pnpm test` all green (note any colima/DB-gated tests). **Commit** — `feat(admin): impersonation + platform analytics + structure guard`

---

## Definition of Done (Epic 3)

- [ ] `/admin` is reachable only by `is_flowmo_staff` (middleware + server-side `requireStaff()` defense-in-depth); non-staff redirected to `/dashboard`; unauthenticated to `/login`. No admin path in `PUBLIC_PAGES`.
- [ ] Tenant provisioning: list + create (all §9.4.1 fields) + detail with automations/users/channels/invoices/audit; suspend/reinstate/churn/edit-contract; **Send Invite** via Supabase `inviteUserByEmail` landing at the Epic 4 `/accept-invite` flow.
- [ ] Automation registry across all tenants with staff-only "Open in Automation Engine" internal deeplink (no n8n calls).
- [ ] Build queue Kanban (Requested→Scoped→Building→UAT→Live); stage transitions audit-logged; "Go Live" sets stage+status; per-stage email is a `TODO(resend)` no-op.
- [ ] Channel credentials vault: pgcrypto-encrypted, raw values never listed/logged, view/rotate senior-ops-only and **every access audit-logged**.
- [ ] Stripe panel from **local** data: MRR/ARR, renewal alerts (7/14/30/60/90), setup-fee pipeline, "Open in Stripe" deeplink, manual-sync stubbed for Epic 8.
- [ ] Impersonation: mandatory reason, read-only, 15-min auto-expiry, persistent banner, start/end audit-logged.
- [ ] Platform analytics dashboard (MRR/ARR, new contracts, churn-risk windows, active automations by type, top tenants, setup-fee pipeline).
- [ ] **Every admin write is audit-logged** to `audit_log`.
- [ ] `pnpm build`/`typecheck`/`lint` pass; `pnpm test` (admin unit + RLS/migration + forms + structure) green; CI green.

**Hand-off:** the admin console + service-role/audit patterns + `lib/admin/*` math are the operational backbone for Epic 7 (tenant dashboard) and Epic 8 (Stripe — replaces local-data reads with live sync + populates webhooks). Engine deeplink + automation registry are ready for Epic 5 to attach live control/status. Impersonation mechanism binds to a real view-as session in Epic 7.
