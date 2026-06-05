# Epic 2 — Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **All page/design/UI work MUST use the `ui-ux-pro-max` skill** (roadmap mandate for Epic 2).

**Goal:** Ship the public marketing website — Home, How It Works, Channels, Pricing (Options A/B/C), Custom Solutions, Case Studies, About, Contact, and Legal (Privacy/Terms/DPA/Cookies) — on a `#FFD400` editorial design system. Every CTA routes to a **Cal.com "Book a Discovery Call"** embed; "Try the Dashboard" routes to `/demo`. Interactive ROI calculator and multi-currency pricing. **No public signup anywhere.**

**Architecture:** All marketing pages live under a Next.js App Router **route group** `src/app/(marketing)/` sharing one `layout.tsx` (Header + Footer). Routes resolve at the exact paths Epic 1 already whitelisted in `src/middleware/access.ts` (`/`, `/pricing`, `/how-it-works`, `/channels`, `/custom-solutions`, `/case-studies`, `/about`, `/contact`, `/privacy`, `/terms`, `/dpa`, `/cookies`) — do not invent new public paths without updating `PUBLIC_PAGES`. Pure logic (pricing tables, ROI math) lives in testable `src/lib/marketing/*` modules with Vitest unit tests; interactive widgets (ROI calculator, currency toggle, Cal.com CTA) are client components tested with Testing Library under jsdom. Content fidelity comes from the PRD: §3 (brand/positioning), §5.2 (transparency), §6.1/§6.4 (pricing + external costs), §9.1 (page list), §18.1 (public language), §18.4 (pricing card).

**Tech Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4 · `next/font` · `@calcom/embed-react` · Vitest · `@testing-library/react` + `jsdom` · zod env.

**Locked decisions:** Discovery CTA → **Cal.com** (link via `NEXT_PUBLIC_CAL_LINK`). Brand assets → **#FFD400 editorial + placeholder wordmark** (swap real logo later). Multi-currency pricing GBP/EUR/USD (matches `tenants.currency`).

**Brand rule (DoD-enforced):** No "n8n" / "workflow" / "execution" / "CabLab" string may appear in any file under `src/app/(marketing)/` or `src/components/marketing/` or `src/lib/marketing/`. Use the §18.1 substitution table ("BookMyCab Automation Engine", "your automation", "run", "channel event", "your bespoke build"). The brand-rule test (Task 1) is the gate.

**Prerequisites:** Epic 1 complete (it is — Next.js app builds, env accessor, middleware with public-path whitelist). Build on branch `epic-2-marketing` (already created).

---

## File structure (created by this epic)

```
src/
  app/
    layout.tsx                       # MODIFY: register fonts (serif headline + geo sans), keep metadata
    globals.css                      # MODIFY: #FFD400 + neutral tokens, font vars, editorial base
    (marketing)/
      layout.tsx                     # marketing shell: <Header/> + <Footer/>
      page.tsx                       # Home  (route "/")
      how-it-works/page.tsx
      channels/page.tsx
      pricing/page.tsx
      custom-solutions/page.tsx
      case-studies/page.tsx
      about/page.tsx
      contact/page.tsx
      privacy/page.tsx
      terms/page.tsx
      dpa/page.tsx
      cookies/page.tsx
    sitemap.ts                       # public routes
    robots.ts
  components/
    marketing/
      header.tsx                     # nav + Discovery CTA (no signup/login link to dashboard only)
      footer.tsx                     # link columns, legal, company, transparency line
      discovery-cta.tsx              # client: Cal.com popup button (NEXT_PUBLIC_CAL_LINK)
      try-dashboard-link.tsx         # → /demo
      dispatch-badges.tsx            # AutoCab · iCabbi · Cordic "Supported" badges
      roi-calculator.tsx             # client: interactive widget (uses lib/marketing/roi)
      currency-toggle.tsx            # client: GBP/EUR/USD switch (context or prop-lifted)
      pricing-cards.tsx              # Option A/B/C cards, currency-aware
      transparency-section.tsx       # "What you pay externally" (§6.4)
      ui/                            # Container, Section, Button, Badge, etc. (design-system primitives)
  lib/
    marketing/
      pricing.ts                     # typed §6.1 pricing + setup fee, multi-currency
      roi.ts                         # pure ROI math
      nav.ts                         # nav + footer link config, company constants
tests/
  marketing-brand.test.ts            # no forbidden strings in marketing source
  pricing.test.ts                    # §6.1 values + currency correctness
  roi.test.ts                        # ROI math cases
  marketing-structure.test.ts        # all pages exist & public-path parity; NO signup route
  roi-calculator.test.tsx            # jsdom: widget renders + recomputes
.env.example                         # MODIFY: NEXT_PUBLIC_CAL_LINK
src/env.ts                           # MODIFY: NEXT_PUBLIC_CAL_LINK (optional)
```

**Responsibility boundaries:** pure data/math (`lib/marketing/*`) is node-unit-tested; presentation is built with `ui-ux-pro-max` and gated by `pnpm build`; one interactive widget (ROI calculator) gets a jsdom behavior test to prove the wiring. The brand-rule and structure tests are cheap guards that protect the two DoD invariants (no forbidden language, no public signup).

---

## Task 1: Design system foundation + marketing shell + brand-rule guard

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/env.ts`, `.env.example`
- Create: `src/lib/marketing/nav.ts`, `src/components/marketing/ui/` primitives (`container.tsx`, `section.tsx`, `button.tsx`, `badge.tsx`), `src/components/marketing/header.tsx`, `src/components/marketing/footer.tsx`, `src/components/marketing/discovery-cta.tsx`, `src/components/marketing/try-dashboard-link.tsx`, `src/app/(marketing)/layout.tsx`, `tests/marketing-brand.test.ts`
- Add deps: `@calcom/embed-react`

**Use the `ui-ux-pro-max` skill** for the design system and shell.

- [ ] **Step 1: Write the brand-rule test first (TDD guard)**

`tests/marketing-brand.test.ts`: recursively read every file under `src/app/(marketing)`, `src/components/marketing`, `src/lib/marketing` and assert none contains (case-insensitive, word-boundary) `n8n`, `workflow`, `execution`, or `CabLab`. Test should pass trivially when dirs are empty/absent, and fail loudly if a forbidden term is introduced. (Guard, not a red test.)

- [ ] **Step 2: Design tokens + fonts**

In `globals.css`, replace the scaffold tokens with the editorial palette: `--color-ink` (near-black `#0A0A0A`), `--color-paper` (`#FFFFFF`), neutral grays, and the cab-livery accent `--color-accent: #FFD400` (+ a readable `--color-accent-ink` for text on yellow). Remove the dark-mode auto scheme (marketing site is light editorial). In `src/app/layout.tsx`, load a **serif display** face for headlines (e.g. `Fraunces` via `next/font/google`) and a **geometric sans** for body (Geist Sans already available, or `Inter`/`Space_Grotesk`), exposing them as CSS vars consumed by Tailwind `@theme`. Keep the existing `metadata` (title "BookMyCab").

- [ ] **Step 3: Env — Cal.com link**

Add to `src/env.ts` schema: `NEXT_PUBLIC_CAL_LINK: z.string().min(1).default("flowmo/discovery")`. Add `NEXT_PUBLIC_CAL_LINK=flowmo/discovery` to `.env.example` under a new "Marketing" group.

- [ ] **Step 4: UI primitives + Discovery CTA + Try-Dashboard link**

Build small design-system primitives in `components/marketing/ui/` (`Container`, `Section`, `Button` with `variant` incl. an accent/yellow primary, `Badge`). `discovery-cta.tsx` is a **client** component using `@calcom/embed-react` (`getCalApi` + popup) bound to `env.NEXT_PUBLIC_CAL_LINK`, rendered as a primary Button labelled "Book a Discovery Call". `try-dashboard-link.tsx` is a Button/link → `/demo` labelled "Try the Dashboard". Both reused everywhere; **no signup/register element anywhere**.

- [ ] **Step 5: Header + Footer + marketing layout**

`nav.ts` exports the nav items (Home, How It Works, Channels, Pricing, Custom Solutions, Case Studies, About, Contact) and footer link columns + company constants (FlowMo AI LTD, UK, tagline §3, transparency promise line). `header.tsx`: placeholder wordmark "BookMyCab" (text/SVG), nav, and a Discovery CTA; mobile menu. `footer.tsx`: link columns, legal links, the transparency one-liner ("You bring your numbers. You own your customer base."). `(marketing)/layout.tsx` wraps children with Header + Footer.

- [ ] **Step 6: Verify**

`pnpm test tests/marketing-brand.test.ts` passes. `pnpm build` succeeds (note: no `(marketing)/page.tsx` yet → Home comes in Task 3; if the route group with only a layout breaks the build, add a temporary minimal `(marketing)/page.tsx` placeholder that Task 3 replaces, OR sequence so the layout lands with Home — implementer's call, keep build green). `pnpm typecheck` clean.

- [ ] **Step 7: Commit** — `feat(marketing): editorial design system, shell, Cal.com CTA, brand-rule guard`

---

## Task 2: Pricing data + ROI math (pure, TDD)

**Files:**
- Create: `src/lib/marketing/pricing.ts`, `src/lib/marketing/roi.ts`, `tests/pricing.test.ts`, `tests/roi.test.ts`

- [ ] **Step 1: Write failing pricing test**

`tests/pricing.test.ts` asserts the §6.1 source of truth: Option A single = {GBP 500, EUR 500, USD 600}; A bundle = {1000,1000,1200}; B single = {800,800,800}; B bundle = {1800,1800,2000}; C = "Contact Us" (no fixed price); setup fee = {1000,1000,1200}; min contract 12 months. Assert a `formatPrice(currency, amount)` renders `£500` / `€500` / `$600` with correct symbols and thousands separators.

- [ ] **Step 2: Write `pricing.ts`**

Typed structures: `type Currency = "GBP"|"EUR"|"USD"`, `CURRENCIES`, per-option/per-config price maps, `SETUP_FEE`, `CONTRACT_MONTHS = 12`, `formatPrice()`. No JSX. Make it match the test exactly.

- [ ] **Step 3: Write failing ROI test**

`tests/roi.test.ts` for `lib/marketing/roi.ts`: define a pure `computeRoi({ missedBookingsPerDay, avgFare, currency, workingDays })` → `{ perDay, perMonth, perYear }` (and any captured-rate assumption documented as a constant). Cover: zero input → zero; a representative case with exact expected numbers; rounding rule; negative/NaN guards clamp to 0.

- [ ] **Step 4: Write `roi.ts`** to pass. Keep the model simple and documented (constants named, no magic numbers).

- [ ] **Step 5: Verify** `pnpm test tests/pricing.test.ts tests/roi.test.ts` → green.

- [ ] **Step 6: Commit** — `feat(marketing): multi-currency pricing model + ROI calculator math`

---

## Task 3: Home page

**Files:**
- Create: `src/app/(marketing)/page.tsx` (replace any Task-1 placeholder), `src/components/marketing/dispatch-badges.tsx`, `src/components/marketing/roi-calculator.tsx`, `tests/roi-calculator.test.tsx`
- May add: `src/components/marketing/currency-toggle.tsx` if ROI widget offers currency

**Use `ui-ux-pro-max`.** Content per §3 (tagline "Your cab company. On every channel. On autopilot."), §5 (offering), §5.2 (transparency promise).

- [ ] **Step 1: ROI calculator client component + jsdom test (TDD)**

`roi-calculator.tsx` ("use client") — inputs (missed bookings/day, avg fare, currency), live output from `computeRoi`. `tests/roi-calculator.test.tsx` (`// @vitest-environment jsdom`, Testing Library): renders, changing an input updates the displayed yearly figure. Write the test first, then the component.

- [ ] **Step 2: dispatch-badges** — AutoCab · iCabbi · Cordic with "Supported" badges (text/placeholder marks; AutoCab = primary/"v1", iCabbi/Cordic = "coming" per §18.2). No external logos required.

- [ ] **Step 3: Home page** — editorial hero (serif headline, accent), value props, channel strip (WhatsApp/Telegram/Messenger/IG/Widget), dispatch badges, embedded ROI calculator, transparency teaser, Discovery CTA + "Try the Dashboard". Per-page `metadata`.

- [ ] **Step 4: Verify** `pnpm test` (brand+roi-calculator green), `pnpm build` (Home renders), `pnpm typecheck`.

- [ ] **Step 5: Commit** — `feat(marketing): home page with ROI calculator and dispatch badges`

---

## Task 4: Pricing page

**Files:**
- Create: `src/app/(marketing)/pricing/page.tsx`, `src/components/marketing/pricing-cards.tsx`, `src/components/marketing/currency-toggle.tsx` (if not built in T3), `src/components/marketing/transparency-section.tsx`

**Use `ui-ux-pro-max`.** Layout per §6.1 / §18.4; transparency per §6.4.

- [ ] **Step 1: currency-toggle** — client GBP/EUR/USD switch; lifts selected currency to the pricing cards (local state or context).

- [ ] **Step 2: pricing-cards** — Option A, B, C cards driven by `lib/marketing/pricing`; A/B show single + bundle prices in the selected currency; C = "Contact Us" → Discovery CTA. Setup fee (£1,000/€1,000/$1,200) and **12-month minimum contract** prominent. "All prices /month · excl. VAT & taxes" line. Add-ons note (Support/Driver/Custom "quoted on demand", §6.3).

- [ ] **Step 3: transparency-section** — "What you pay externally" table from §6.4 (WhatsApp/Telegram/IG fees, LLM tokens, dispatch API subscription = customer-borne; BookMyCab subscription + setup fee = to BookMyCab). Reusable (also linkable from Home/Channels).

- [ ] **Step 4: Pricing page** assembles toggle + cards + transparency + dispatch badges + Discovery CTA. `metadata`.

- [ ] **Step 5: Verify** build + typecheck + tests green. Manually confirm currency toggle changes all displayed prices.

- [ ] **Step 6: Commit** — `feat(marketing): pricing page (A/B/C), currency toggle, transparency`

---

## Task 5: How It Works + Channels pages

**Files:**
- Create: `src/app/(marketing)/how-it-works/page.tsx`, `src/app/(marketing)/channels/page.tsx`

**Use `ui-ux-pro-max`.**

- [ ] **Step 1: How It Works** — the customer journey (§9.2, public framing only): discovery call → bespoke build → channels connected → go live; emphasise "bespoke per customer" (§5.1) and booking modes (ASAP/Scheduled/Airport with flight tracking, §5.1). End with Discovery CTA. **No engine internals named** (brand rule).

- [ ] **Step 2: Channels** — grid of WhatsApp Business, Telegram, Messenger, Instagram DM, on-site Chat widget (§5.1). Prominent **customer-owned credentials** transparency block (§5.2): "You connect your own numbers; you pay channel fees directly; you own your customers." Discovery CTA.

- [ ] **Step 3: Verify** build + typecheck + brand test green.

- [ ] **Step 4: Commit** — `feat(marketing): how-it-works and channels pages`

---

## Task 6: Custom Solutions + Case Studies + About

**Files:**
- Create: `src/app/(marketing)/custom-solutions/page.tsx`, `src/app/(marketing)/case-studies/page.tsx`, `src/app/(marketing)/about/page.tsx`

**Use `ui-ux-pro-max`.**

- [ ] **Step 1: Custom Solutions** — Option C / enterprise + add-on automations (§6.3: Support Bot, Driver Solution, Lost Property, Complaints/CSAT, Marketing automations, Custom integrations, additional channels, Voice agent v1.3). All routes to Discovery CTA ("Contact Us, quoted individually").

- [ ] **Step 2: Case Studies** — placeholder/illustrative cases (clearly framed as representative until real logos land — brand-assets-placeholder decision). Structure that real studies slot into later. Discovery CTA.

- [ ] **Step 3: About** — FlowMo AI LTD, UK origin (§3), positioning/tone ("confident, technical-but-friendly, transparent, no hype"), the transparency promise. Discovery CTA.

- [ ] **Step 4: Verify** build + typecheck + brand test green.

- [ ] **Step 5: Commit** — `feat(marketing): custom-solutions, case-studies, about pages`

---

## Task 7: Contact + Legal pages

**Files:**
- Create: `src/app/(marketing)/contact/page.tsx`, `src/app/(marketing)/privacy/page.tsx`, `src/app/(marketing)/terms/page.tsx`, `src/app/(marketing)/dpa/page.tsx`, `src/app/(marketing)/cookies/page.tsx`

**Use `ui-ux-pro-max`.**

- [ ] **Step 1: Contact** — **no signup form.** Primary action is the Cal.com Discovery CTA (inline embed acceptable) plus contact details (email `hello@bookmycab.com`, company FlowMo AI LTD, UK). Optional simple message field is allowed ONLY as a `mailto:` or a clearly-marked placeholder — do **not** build a backend submit (Resend wiring is a later epic). Keep it dependency-free.

- [ ] **Step 2: Legal stubs** — Privacy, Terms, DPA, Cookie Policy. Real legal copy is Epic 12; here ship structured placeholder pages with headings, a "Last updated" date, and a notice that final terms are issued at contract. Consistent legal-page layout component is fine.

- [ ] **Step 3: Verify** build + typecheck + brand test green.

- [ ] **Step 4: Commit** — `feat(marketing): contact and legal (privacy/terms/dpa/cookies) pages`

---

## Task 8: SEO, sitemap/robots, structure test, final pass

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `tests/marketing-structure.test.ts`
- Verify/modify: `src/middleware/access.ts` (only if a route was added outside the whitelisted set)

- [ ] **Step 1: Structure test (TDD guard)**

`tests/marketing-structure.test.ts`: assert each expected page file exists under `src/app/(marketing)/`; assert the set of marketing routes is a subset of `PUBLIC_PAGES` in `access.ts` (no protected marketing route); assert **no** `signup`/`register`/`sign-up` route file exists anywhere under `src/app`.

- [ ] **Step 2: Per-page metadata audit** — ensure every page exports `metadata` (title + description, OpenGraph where sensible). Add `sitemap.ts` (all public routes) and `robots.ts` (allow all, point to sitemap).

- [ ] **Step 3: Public-path parity** — confirm all marketing routes resolve unauthenticated (they're in `PUBLIC_PAGES` from Epic 1). If any new path was introduced, add it to `PUBLIC_PAGES` and note it. Re-run `tests/access.test.ts`.

- [ ] **Step 4: Full verification**

```bash
pnpm lint
pnpm typecheck   # with placeholder public env vars
pnpm build
pnpm test        # marketing-brand, pricing, roi, roi-calculator, marketing-structure + Epic 1 suite that doesn't need DB
```

All green. (DB-dependent Epic 1 tests still need Docker/supabase; not required for marketing tasks — note if skipped.)

- [ ] **Step 5: Commit** — `feat(marketing): sitemap, robots, metadata, structure guard`

---

## Definition of Done (Epic 2)

- [ ] All 12 public pages render at the §9.1 routes (`/`, `/how-it-works`, `/channels`, `/pricing`, `/custom-solutions`, `/case-studies`, `/about`, `/contact`, `/privacy`, `/terms`, `/dpa`, `/cookies`).
- [ ] `#FFD400` editorial design system (serif headlines + geo sans, black/white base) applied via shared marketing layout (Header + Footer).
- [ ] Every CTA → Cal.com "Book a Discovery Call" (via `NEXT_PUBLIC_CAL_LINK`). **No public signup/registration anywhere.**
- [ ] Pricing page shows Options A/B/C per §6.1 with working GBP/EUR/USD toggle, setup fee, and 12-month contract; transparency "what you pay externally" section present (§6.4).
- [ ] ROI calculator widget is interactive and recomputes live (jsdom test proves it).
- [ ] Dispatch badges (AutoCab/iCabbi/Cordic) and "Try the Dashboard" → `/demo` present.
- [ ] Brand rule holds: no "n8n"/"workflow"/"execution"/"CabLab" in marketing source (brand-rule test green).
- [ ] `pnpm build`, `pnpm typecheck`, `pnpm lint` pass; `pnpm test` marketing suite green; CI green on PR.

**Hand-off:** marketing shell, design primitives, pricing/ROI modules, and the Cal.com CTA are reusable by later epics. Demo link target `/demo` is delivered by Epic 9; until then it routes to the (public) path which 404s gracefully — acceptable for Epic 2.
