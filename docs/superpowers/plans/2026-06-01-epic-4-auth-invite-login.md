# Epic 4 — Auth & Invite-Only Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute with `superpowers:subagent-driven-development` (implementer → spec review → quality review per task). **All auth screens MUST use the `ui-ux-pro-max` skill** (roadmap mandate). Steps use `- [ ]` checkboxes for tracking.

**Goal:** Complete the user-facing authentication flows on top of the Epic 1 skeleton — **invite-only** login (no public signup), password set/reset, TOTP MFA enforced for Owner/Admin, and MFA-aware route protection. Every account is created by a FlowMo admin via Supabase `invite()`; users set their own password from the invite link, then sign in.

**What already exists (Epic 1 — do NOT rebuild):**
- `src/lib/supabase/{browser,server,middleware}.ts` — SSR/browser client wrappers.
- `src/middleware/access.ts` — pure `evaluateAccess(pathname, claims)` policy + exported `PUBLIC_PAGES`; `middleware.ts` wires it and already reads `supabase.auth.getClaims()`.
- Custom-access-token hook (migration `0006`) injects `tenant_id`, `role`, `is_flowmo_staff` into the JWT.
- DB: `public.users` (has `last_login_at`), `public.tenant_users` (has `accepted_at`, `role`, `automation_restrictions`), RLS policies.
- `src/env.ts` with `NEXT_PUBLIC_SITE_URL` (defaulted) and `FLOWMO_STAFF_EMAIL_DOMAIN`.

**Architecture:** Auth screens live under a Next.js App Router **route group** `src/app/(auth)/` sharing a minimal centered `layout.tsx` (no marketing header/footer). Routes: `/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/mfa`. Mutations run through **server actions** in `src/app/(auth)/actions.ts` using the SSR server client; the browser client is only used where the Supabase JS SDK must run client-side (MFA enroll/challenge reads a QR secret; password reset session is established from the URL hash). Pure routing/MFA-gate logic stays in `src/middleware/access.ts` and is unit-tested. A minimal `/dashboard` holding-state page (PRD §9.2 step 6) is added only as a post-login landing target — **Epic 7 replaces it**; `/admin` is delivered by Epic 3 (staff land there once it exists).

**Tech Stack:** Next.js 15 server actions · `@supabase/ssr` · `@supabase/supabase-js` MFA API · React 19 · Tailwind v4 · Vitest + Testing Library/jsdom · zod env.

**Spec sources:** PRD §7.4 (auth config: invite-only, MFA Owner/Admin, 7-day sliding session, after-sign-in updates `last_login_at`), §9.2 (admin-driven onboarding: invite → set password → holding state), §12.1 (middleware enforces JWT, `tenant_id`↔`:orgId`, `is_flowmo_staff` for `/admin/*`), Epic 4 (§ epic list: SSR+browser, invite flow, TOTP MFA, RLS-aware route protection).

**Locked decisions for this epic:**
- **No public signup** anywhere — there is no `/signup`/`/register` route, and nothing links to one. (The Epic 2 structure test already guards this; keep it green.)
- **MFA:** TOTP only; **enforced** (blocking) for `Owner` and `Admin` roles; **optional** for `Viewer`. Enforcement = a session at `aal1` for an Owner/Admin is redirected to `/mfa` for every protected route until it reaches `aal2`.
- **Post-login redirect:** `is_flowmo_staff` → `/admin`; otherwise → `/dashboard`.
- **Session:** rely on Supabase defaults configured in `supabase/config.toml` (7-day sliding window, refresh-token rotation). If config drift is found, note it — do not silently change auth config.
- **Email delivery:** Supabase Auth sends invite/reset emails (local: Inbucket). Resend templating is **not** in scope here.

**Brand rule:** auth screens are customer-facing — no `n8n`/`workflow`/`execution`/`CabLab` strings (the existing `marketing` brand test does not cover `(auth)`; this epic does not extend it, but the same language discipline applies — use "CabbyBot").

**Prerequisites:** Epic 1 complete. Branch `epic-4-auth` (already created off `epic-2-marketing`). Local Supabase via colima for DB-backed tests; **run `pnpm test`/`vitest` and `supabase` from the main shell with `dangerouslyDisableSandbox: true`** (sandbox hangs external binaries; subagents run unsandboxed and are fine).

---

## File structure (created/modified by this epic)

```
src/
  middleware/access.ts                 # MODIFY: add `aal` to Claims; MFA-gate for Owner/Admin; widen public auth prefixes
  app/
    (auth)/
      layout.tsx                       # minimal centered auth shell (ui-ux-pro-max)
      login/page.tsx                   # + login-form.tsx (client)
      forgot-password/page.tsx         # + forgot-form.tsx (client)
      reset-password/page.tsx          # + reset-form.tsx (client)
      accept-invite/page.tsx           # + accept-form.tsx (client)
      mfa/page.tsx                     # + mfa-enroll.tsx, mfa-challenge.tsx (client)
      actions.ts                       # server actions: signIn, signOut, requestReset, updatePassword, acceptInvite, recordLogin
    dashboard/page.tsx                 # MINIMAL holding-state landing (Epic 7 replaces)
  components/
    auth/
      auth-card.tsx                    # shared card/heading/error primitives for auth screens
      field.tsx                        # labelled input + error text
      submit-button.tsx                # client submit w/ pending state (useFormStatus)
  lib/
    auth/
      session.ts                       # getUser(), getCurrentClaims(), requireUser(), redirectTargetFor(claims)
middleware.ts                          # MODIFY: extract `aal` from claims, pass into evaluateAccess
tests/
  access.test.ts                       # MODIFY/EXTEND: MFA-gate + auth-route reachability cases
  auth-session.test.ts                 # redirectTargetFor + claim parsing (pure)
  auth-forms.test.tsx                  # jsdom: login/forgot/reset/accept forms render + validate + call action
.env.example                           # MODIFY: note invite-only; no new required vars
```

**Responsibility boundaries:** pure routing/MFA-gate and `redirectTargetFor` logic are node-unit-tested (`access.test.ts`, `auth-session.test.ts`); forms are built with `ui-ux-pro-max` and behavior-tested under jsdom (render + client validation + action invocation, with the server action / Supabase client mocked); end-to-end auth (real Supabase sign-in, real TOTP, real invite email) is **Playwright in Epic 11** — do not attempt full e2e here. Each task ends green on `pnpm test` + `pnpm typecheck` + `pnpm build` + `pnpm lint`.

---

## Task 1: MFA-aware access policy + auth session helpers (pure, TDD)

**Files:**
- Modify: `src/middleware/access.ts`, `middleware.ts`, `tests/access.test.ts`
- Create: `src/lib/auth/session.ts`, `tests/auth-session.test.ts`

- [ ] **Step 1: Extend the access policy test first (TDD)**

In `tests/access.test.ts` add cases for the new MFA gate. Extend the `Claims` type usage with an `aal` field (`"aal1" | "aal2" | null`). New assertions:
  - Unauthenticated request to a protected route (`/dashboard`) → `{ kind: "redirect", to: "/login" }` (unchanged).
  - Authenticated **Owner** at `aal1` to `/dashboard` → `{ kind: "redirect", to: "/mfa" }`.
  - Authenticated **Admin** at `aal1` to `/dashboard` → `{ kind: "redirect", to: "/mfa" }`.
  - Authenticated **Viewer** at `aal1` to `/dashboard` → `{ kind: "allow" }` (MFA optional for Viewer).
  - Owner at `aal2` to `/dashboard` → `{ kind: "allow" }`.
  - Owner at `aal1` to `/mfa` → `{ kind: "allow" }` (the MFA page itself must be reachable to satisfy the gate).
  - Owner at `aal1` to `/login`, `/accept-invite`, `/forgot-password`, `/reset-password` → `{ kind: "allow" }` (auth flow reachable; never trap a user in a redirect loop).
  - `is_flowmo_staff` Owner at `aal1` to `/admin` → `{ kind: "redirect", to: "/mfa" }` (staff are high-privilege; MFA-gated too).

- [ ] **Step 2: Implement the policy changes**

In `access.ts`: add `aal: "aal1" | "aal2" | null` to `Claims`. Add a constant `AUTH_ROUTES = ["/login","/forgot-password","/reset-password","/accept-invite","/mfa"]` and treat them as always-reachable (allow) so the gate can't loop. Add `MFA_REQUIRED_ROLES = new Set(["Owner","Admin"])`. After the existing public-path allow and the unauthenticated redirect, insert the MFA gate: if `claims` present, the path is **not** an auth route, and `MFA_REQUIRED_ROLES.has(claims.role)` and `claims.aal !== "aal2"` → `{ kind: "redirect", to: "/mfa" }`. Keep all existing `/admin` and `/api/orgs/:orgId` rules afterward. Export `AUTH_ROUTES`.

- [ ] **Step 3: Wire `aal` through middleware**

In `middleware.ts`, read `raw.aal` from the verified claims and set `aal: (raw.aal as Claims["aal"]) ?? null` on the constructed `claims`. (Supabase access-token JWTs carry the `aal` claim.) No behavior change for anonymous requests.

- [ ] **Step 4: Auth session helpers + their test (TDD)**

`src/lib/auth/session.ts`:
  - `getUser()` → `supabase.auth.getUser()` via the **server** client; returns the user or null.
  - `getCurrentClaims()` → returns the parsed `Claims | null` from `supabase.auth.getClaims()` (same shape as middleware builds, including `aal`).
  - `redirectTargetFor(claims: Claims): string` → **pure**, exported, returns `"/admin"` if `is_flowmo_staff` else `"/dashboard"`. (Unit-tested in `tests/auth-session.test.ts`; the Supabase-touching helpers are not unit-tested here — they're exercised by build + later Playwright.)
  - `requireUser()` → returns claims or `redirect("/login")` (uses `next/navigation` redirect); for use by server components/actions.

`tests/auth-session.test.ts`: cover `redirectTargetFor` for staff vs Owner vs Viewer, and any pure claim-normalization helper you extract.

- [ ] **Step 5: Verify** — `pnpm test tests/access.test.ts tests/auth-session.test.ts` green; `pnpm typecheck` clean; `pnpm build` green.

- [ ] **Step 6: Commit** — `feat(auth): MFA-aware route gate + auth session helpers`

---

## Task 2: Auth shell + login + logout (+ last_login_at)

**Use `ui-ux-pro-max`** for the auth shell and form design (clean, centered, on-brand — NOT the marketing editorial system; a focused product-auth aesthetic).

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/login-form.tsx`, `src/app/(auth)/actions.ts`, `src/components/auth/{auth-card,field,submit-button}.tsx`, `src/app/dashboard/page.tsx`, `tests/auth-forms.test.tsx`
- Modify: `.env.example` (comment: invite-only; INBUCKET note for local)

- [ ] **Step 1: Shared auth primitives + shell**

`components/auth/auth-card.tsx` (card container + wordmark "CabbyBot" + heading + optional error banner), `field.tsx` (labelled input + inline error + `aria-describedby`), `submit-button.tsx` (`"use client"`, uses `useFormStatus` for a pending/disabled state). `(auth)/layout.tsx`: full-height centered layout, neutral background, no marketing nav. Keep accessible (labels, focus ring, `aria-live` for errors).

- [ ] **Step 2: Server actions skeleton + `signIn`**

`(auth)/actions.ts` (`"use server"`):
  - `signIn(prevState, formData)`: validate email+password with zod; `supabase.auth.signInWithPassword`; on error return a field/form error state; on success call `recordLogin(userId)` then `redirect(redirectTargetFor(claims))`. Read claims via `getCurrentClaims()` after sign-in (the SSR client now has the session).
  - `recordLogin(userId)`: update `public.users.last_login_at = now()` for the signed-in user (RLS must permit a user to update their own row; if the existing RLS policy doesn't allow it, use the **service-role** client confined to this single update — note the choice in the commit). PRD §7.4 "after-sign-in hook updates `last_login_at`".
  - `signOut()`: `supabase.auth.signOut()` then `redirect("/login")`.

- [ ] **Step 3: Login page + form**

`login/page.tsx` (server component; if already authenticated, redirect to the role target). `login-form.tsx` (`"use client"`, `useActionState(signIn, …)`): email, password, submit; "Forgot password?" link → `/forgot-password`; **no signup link**; surface action errors via `aria-live`. A subtle note: "Access is invite-only — contact your CabbyBot administrator."

- [ ] **Step 4: Dashboard holding-state placeholder**

`src/app/dashboard/page.tsx`: minimal server component reading `requireUser()`; renders the PRD §9.2 step-6 holding state — "Your automation is being built. We'll notify you when it goes live." — plus a sign-out button (calls `signOut`). Clearly marked as a temporary landing replaced by Epic 7. (Do **not** build dashboard features.)

- [ ] **Step 5: Form behavior test (TDD-style; write alongside)**

`tests/auth-forms.test.tsx` (`// @vitest-environment jsdom`): render `LoginForm` with a mocked `signIn` action; assert fields render with labels, client-side empty-submit shows validation, and submitting valid input invokes the action. Mock `next/navigation` and the action module.

- [ ] **Step 6: Verify** — `pnpm test` (new + existing green), `pnpm typecheck`, `pnpm build`, `pnpm lint`. Confirm `marketing-structure` "no signup route" test still passes.

- [ ] **Step 7: Commit** — `feat(auth): login, logout, auth shell + last_login_at`

---

## Task 3: Forgot password + reset password

**Use `ui-ux-pro-max`.**

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx` (+ `forgot-form.tsx`), `src/app/(auth)/reset-password/page.tsx` (+ `reset-form.tsx`)
- Modify: `src/app/(auth)/actions.ts`, `tests/auth-forms.test.tsx`

- [ ] **Step 1: `requestReset` + `updatePassword` actions**

In `actions.ts`: `requestReset(prev, formData)` → zod email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${env.NEXT_PUBLIC_SITE_URL}/reset-password })`; **always** return a neutral success message ("If that email exists, we've sent a reset link.") to avoid account enumeration. `updatePassword(prev, formData)` → zod password (min length, confirm match) → `supabase.auth.updateUser({ password })` → on success `redirect("/login?reset=1")`.

- [ ] **Step 2: Forgot page + form** — email field, submit, neutral confirmation; link back to `/login`.

- [ ] **Step 3: Reset page + form** — `reset-form.tsx` is `"use client"`: on mount the page has a Supabase recovery session from the email link (the `@supabase/ssr` browser client picks up the code/hash); render new-password + confirm fields calling `updatePassword`. If no recovery session is present, show an "invalid or expired link" state with a link to `/forgot-password`.

- [ ] **Step 4: Tests** — extend `auth-forms.test.tsx`: forgot form renders + validates + calls `requestReset`; reset form validates password match and calls `updatePassword` (action + Supabase mocked).

- [ ] **Step 5: Verify** — test/typecheck/build/lint green.

- [ ] **Step 6: Commit** — `feat(auth): forgot-password and reset-password flows`

---

## Task 4: Invite acceptance / set-password

**Use `ui-ux-pro-max`.**

**Files:**
- Create: `src/app/(auth)/accept-invite/page.tsx` (+ `accept-form.tsx`)
- Modify: `src/app/(auth)/actions.ts`, `tests/auth-forms.test.tsx`

- [ ] **Step 1: Invite link handling**

Supabase `invite()` emails a link that establishes a session (type `invite`) and lands the user on a configured redirect. Point that redirect at `/accept-invite`. `accept-form.tsx` (`"use client"`): on mount, confirm a Supabase session exists from the invite link; render full name (optional) + password + confirm.

- [ ] **Step 2: `acceptInvite` action**

In `actions.ts`: `acceptInvite(prev, formData)` → zod (password min + confirm, optional full name) → `supabase.auth.updateUser({ password, data: { full_name } })`; then mark acceptance: set `public.users.full_name` and `public.tenant_users.accepted_at = now()` for this user's membership row(s) where `accepted_at is null` (service-role client confined to these updates, since the user may not yet have RLS-visible rows pre-acceptance — note the choice). Then `redirect(redirectTargetFor(claims))`. If no invite session is present, show an "invalid or expired invite" state.

- [ ] **Step 3: Accept page** — server component wrapping the client form; if already fully signed in with a password set and `accepted_at` present, redirect to the role target.

- [ ] **Step 4: Tests** — extend `auth-forms.test.tsx`: accept form renders, validates password match, calls `acceptInvite` (mocked). 

- [ ] **Step 5: Verify** — green.

- [ ] **Step 6: Commit** — `feat(auth): invite acceptance + set-password flow`

---

## Task 5: TOTP MFA — enroll + challenge/verify

**Use `ui-ux-pro-max`** (QR + code entry should feel calm and clear).

**Files:**
- Create: `src/app/(auth)/mfa/page.tsx`, `src/app/(auth)/mfa/mfa-enroll.tsx`, `src/app/(auth)/mfa/mfa-challenge.tsx`
- Modify: `tests/auth-forms.test.tsx`

- [ ] **Step 1: MFA page routing logic**

`mfa/page.tsx` (server component): read `getCurrentClaims()` and `supabase.auth.mfa.listFactors()` server-side to decide mode:
  - No verified TOTP factor → render `<MfaEnroll/>`.
  - A verified factor exists but session is `aal1` → render `<MfaChallenge/>`.
  - Already `aal2` → `redirect(redirectTargetFor(claims))`.
  - Unauthenticated → `redirect("/login")`.

- [ ] **Step 2: Enroll component** (`"use client"`, browser Supabase client)

`mfa-enroll.tsx`: `supabase.auth.mfa.enroll({ factorType: "totp" })` → render the returned QR (SVG/`totp.qr_code`) and the secret as text fallback; user enters a 6-digit code; `mfa.challenge` + `mfa.verify` (or `challengeAndVerify`) → on success `window.location.assign(redirectTarget)` (full reload so middleware re-reads the now-`aal2` session). Handle/verify errors inline.

- [ ] **Step 3: Challenge component** (`"use client"`)

`mfa-challenge.tsx`: for an existing factor, `challengeAndVerify({ factorId, code })`; on success reload to the redirect target; surface invalid-code errors.

- [ ] **Step 4: Tests** — extend `auth-forms.test.tsx`: enroll renders a code input + (mocked) QR and calls verify; challenge validates a 6-digit code and calls `challengeAndVerify`. Mock `@supabase/ssr` browser client. (Real TOTP is Playwright/Epic 11.)

- [ ] **Step 5: Verify** — test/typecheck/build/lint green. Manually reason through the gate: Owner `aal1` → `/mfa` → enroll/verify → `aal2` → role target.

- [ ] **Step 6: Commit** — `feat(auth): TOTP MFA enrollment and challenge`

---

## Task 6: Auth structure guard + final pass

**Files:**
- Create: `tests/auth-structure.test.ts`
- Verify/modify: `src/app/(auth)/layout.tsx`, `src/middleware/access.ts` (only if a route is missing from the reachable-auth set)

- [ ] **Step 1: Structure guard (TDD)**

`tests/auth-structure.test.ts`: assert each auth page file exists (`/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/mfa`); assert every `AUTH_ROUTES` entry has a corresponding page; re-assert (cheap dup of the marketing guard) that **no** `signup`/`register`/`sign-up` route exists under `src/app`; assert each auth route resolves to `{ kind: "allow" }` from `evaluateAccess` for an `aal1` Owner (no redirect loop).

- [ ] **Step 2: Metadata + a11y pass** — every auth page exports `metadata` (title + `robots: { index: false }` — auth pages must not be indexed). Confirm the Epic 2 `robots.ts` already disallows `/login` and `/auth`; add `/mfa`, `/accept-invite`, `/forgot-password`, `/reset-password` to its `disallow` list. Quick a11y check: labelled inputs, focus-visible rings, `aria-live` error regions.

- [ ] **Step 3: Full verification**

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test        # access, auth-session, auth-forms, auth-structure + Epic 1/2 suites that don't need DB
```
All green. (DB-dependent Epic 1 tests still need colima/supabase; note if skipped.)

- [ ] **Step 4: Commit** — `feat(auth): auth structure guard, no-index metadata, final pass`

---

## Definition of Done (Epic 4)

- [ ] Invite-only login works end-to-end in reasoning: admin `invite()` → `/accept-invite` set password → `/login` → role-based redirect. **No public signup route or link anywhere** (structure test green).
- [ ] Forgot/reset password flow present; reset is enumeration-safe (neutral response).
- [ ] TOTP MFA: Owner/Admin at `aal1` are blocked from every protected route and routed to `/mfa`; enrollment + challenge reach `aal2`; Viewer is not forced into MFA.
- [ ] `middleware.ts` passes `aal` into the pure `evaluateAccess`; auth routes never loop; `/admin/*` still requires `is_flowmo_staff`; `:orgId` tenant check unchanged.
- [ ] `last_login_at` updated on sign-in.
- [ ] Auth screens built with `ui-ux-pro-max`; no-index metadata; accessible forms.
- [ ] `pnpm build`/`typecheck`/`lint` pass; `pnpm test` auth suite green; CI green on PR.

**Hand-off to Epic 3:** `requireUser()`, `getCurrentClaims()`, `redirectTargetFor()`, the auth shell/primitives, and the MFA-gated middleware are reusable by the admin console. `/admin` is the staff post-login target — Epic 3 builds it; until then staff land on a 404 at `/admin`, which is acceptable for Epic 4 (mirrors Epic 2's `/demo` hand-off).
