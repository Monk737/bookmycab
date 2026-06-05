# Product

## Register

product

> Dual-register project. The default above (`product`) governs the tenant **dashboard** and FlowMo **admin console** — the bulk of the surface area. The public **marketing site** (`/`, pricing, case-studies, how-it-works, legal) is a **brand** surface: switch register to `brand` per-task when working those routes. Pick by the surface in focus, not by this default.

## Users

Two distinct audiences, one platform:

- **Cab/taxi operators (tenant users)** — Owners, admins, and dispatch staff at small-to-mid UK private-hire firms. Context: busy ops desk, often a second screen next to their dispatch system (AutoCab/iCabbi/Cordic), glancing at a live booking feed between calls. Job to be done: confirm the automation is booking correctly, watch live conversations, pull analytics, adjust bot config, manage billing — without touching n8n or thinking about "AI."
- **FlowMo staff (admin)** — Internal team provisioning tenants, running the build queue, managing Stripe, and (read-or-write scoped) impersonating tenants for support. Context: operator-grade internal tooling; speed and auditability over polish.
- **Prospects (marketing site)** — Cab-firm owners evaluating whether to book a discovery call. No self-serve signup exists; the only conversion is "talk to us." They need to trust that this is a serious, bespoke product, not a chatbot template.

## Product Purpose

BookMyCab (by FlowMo AI LTD) gives each cab company a **bespoke** omnichannel booking bot across WhatsApp, Telegram, Messenger, Instagram, and a web widget. Customer messages (including voice notes) flow through an internal automation engine that runs a booking state machine, calls the firm's dispatch system, and writes confirmed bookings back to a live dashboard. Every customer gets a tailored build — never a template clone — and is provisioned by FlowMo admin only.

Success looks like: operators trust the bot enough to leave it running unattended; bookings land correctly in their dispatch system; the dashboard answers "is it working and what is it doing?" at a glance; and prospects who hit the marketing site believe this is bespoke, serious infrastructure worth a discovery call.

## Brand Personality

**Confident, editorial, precise.** Voice is plain-spoken and specific — names what the product literally does, never hides behind AI hype or buzzwords. Editorial in the literal sense: the existing system pairs a display serif (Fraunces) with a clean sans (Inter) on an ink-on-paper light theme, with a single decisive taxi-yellow accent. The feeling to evoke: this is built by people who know the private-hire trade, not a generic SaaS dashboard with a cab logo bolted on. Calm authority over flash.

Hard brand rule (non-negotiable, from CLAUDE.md): the automation engine is **n8n internally but must NEVER appear on any customer-facing surface** — always "BookMyCab Automation Engine" or "your automation." The product name is **BookMyCab** everywhere (never the old "CabbyBot" or "CabLab").

## Anti-references

- **Generic SaaS landing** — cream/sand warm-neutral body bg, purple-to-blue gradient hero, the hero-metric template (big number + small label grid), identical icon-heading-text card rows. This is the single biggest thing to avoid on the marketing site.
- **Gradient-text + glassmorphism "AI startup" aesthetic** — decorative blur cards, gradient headlines. The product is infrastructure, not a hype deck.
- **Clip-art taxi clichés** — checkered patterns, cartoon cabs, emoji cars, traffic-light motifs.
- **Chatbot-toy look** — rounded speech-bubble mascots, playful gradients that signal "toy assistant" rather than operational tooling.
- **Cold corporate-blue enterprise template** — the stale auto-generated blue/Fira-Code dashboard doc in `design-system/` is NOT the real system; ignore it. The real system is editorial light + yellow.

## Design Principles

1. **Operator-grade, not decorative.** Every dashboard screen serves a glance-and-act workflow at a busy ops desk. Data density and scannability beat ornament. If a widget doesn't help someone answer "is it working?", cut it.
2. **Bespoke, never template.** The brand promise is tailored builds. The UI should feel considered and specific, never like a cloned SaaS starter. Avoid the AI-slop reflexes that make products look interchangeable.
3. **Hide the machinery, name the value.** Customers never see "n8n" or AI plumbing. Surface what the automation *did* (booked, quoted, dispatched), not how. Plain nouns and verbs over jargon.
4. **Trust through precision.** Accurate live data, honest states (building/uat/live/stopped/error), visible audit trails, real empty/error states. The product earns unattended trust by never lying about what's happening.
5. **One confident accent.** Taxi-yellow is the single decisive accent on an editorial ink/paper base. Restraint carries the authority; resist the urge to add a second brand color.

## Accessibility & Inclusion

WCAG 2.2 AA across both registers:

- Body text ≥4.5:1 contrast; large text ≥3:1. Watch the yellow accent — `#ffd400` needs dark ink text on it, never white, and never as low-contrast text on white.
- Visible focus states on all interactive elements (keyboard nav fully supported — operators may be keyboard-fast).
- `prefers-reduced-motion: reduce` honored on every animation (live feed updates, reveals, transitions).
- Responsive and tested at 375 / 768 / 1024 / 1440px; no horizontal scroll on mobile; no content hidden behind fixed nav.
- Chart/analytics colors should remain distinguishable for color-blind users (don't rely on hue alone — pair with label/shape/value).
