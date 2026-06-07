---
target: marketing site
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-06-06T14-12-12Z
slug: src-app-marketing-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | ROI calc + booking demo give live feedback; little else to status on a marketing site |
| 2 | Match System / Real World | 4 | Operator-native copy throughout (missed fares, controllers, dispatch, the night line) |
| 3 | User Control and Freedom | 3 | Clear nav, adjustable ROI inputs, currency toggle; no traps |
| 4 | Consistency and Standards | 4 | One committed Neo-Brutalism system applied cohesively across every page |
| 5 | Error Prevention | 3 | ROI sliders are bounded; no destructive actions; few inputs to get wrong |
| 6 | Recognition Rather Than Recall | 4 | Labeled nav, named channels/dispatch, nothing hidden behind memory |
| 7 | Flexibility and Efficiency | 3 | CTAs everywhere, currency + plan toggles; marketing needs no shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Bold and purposeful, but uppercase + density runs hot across many sections |
| 9 | Error Recovery | 3 | Minimal error surface; the demo CTA dead-ends without backend (see P1) |
| 10 | Help and Documentation | 3 | How It Works + Status carry it; no search, none needed at this size |
| **Total** | | **33/40** | **Good** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.**

**LLM assessment**: This reads as a deliberately art-directed brand, not a template. It avoids the 2026 SaaS-cream monoculture entirely: committed Neo-Brutalism (true ink frames, hard offset shadows, sharp corners, one loud taxi-yellow), operator-native copy that names what the product does, a real animated product demo, and a cab logo + Made-in-UK badge that ground it in the trade. No gradient text, no glassmorphism, no eyebrow-on-every-section, no identical icon-card grids, no hero-metric template. Brutalism is itself a recognizable lane, but the execution is specific enough (the trade voice, the yellow, the dispatch language) that it reads as *this brand*, not *an AI brand*.

**Deterministic scan**: `detect.mjs --json src/app/(marketing)` returned `[]` — zero findings across all marketing pages. The detector and the design review agree: no slop tells.

**Visual evidence**: captured full-page renders of home, pricing, custom-solutions, about, case-studies, status, how-it-works at 1440px, plus reduced-motion and the animated booking demo at two scenario frames. No live in-page overlay was injected; direct screenshots were used instead.

## Overall Impression

Confident and distinctive. The system is cohesive and the copy is the strongest asset — it sounds like it was written by someone who has worked a dispatch desk. The single biggest opportunity is the **"Try the Dashboard" path**: it's a primary CTA on nearly every page, but it dead-ends at a login wall when the demo tenant isn't provisioned, which is the worst possible moment to lose a curious prospect.

## What's Working

1. **A committed, consistent visual system.** Ink frames + hard shadows + one accent, applied the same way on every page. Nothing feels stitched together (heuristic 4 = 4).
2. **The dual-mode booking demo.** It alternates voice-note and tap-to-book flows on a loop and tells the whole product story in one glance. This is real product proof, not decoration.
3. **Trade-specific copy.** "Never lose a fare to a missed call", "the line that never goes engaged", controllers/dispatch/night-line language. This is what makes it un-generic.

## Priority Issues

- **[P1] The "Try the Dashboard" CTA dead-ends.** It's a top-level CTA across the site, but `/demo` redirects to `/login?demo_error=1` unless a Supabase demo tenant is configured. A first-timer who clicks the second-most-prominent button hits a login wall with a cryptic `?demo_error=1`. **Fix**: provision the demo session, OR change the CTA copy/destination until it works (e.g., point it at How It Works, or gate it behind "coming soon"), OR show a friendly "demo opening shortly" state instead of the login bounce.
- **[P1] Contact has no lightweight "message us" path.** The contact page offers a discovery-call booking and an email address, but no form. A cautious first-timer not ready for a call has only "open my email client". **Fix**: add a minimal contact form (name, firm, message) or make the email a clearly-labeled mailto with a subject prefilled, so there's a low-commitment option.
- **[P2] Uppercase + density runs hot.** Almost every heading is uppercase extrabold; across a long scroll it fatigues and some long H2s get hard to scan. **Fix**: let 2-3 of the longest section headings drop to sentence case (still extrabold) to vary the texture; reserve all-caps for the short, punchy ones.
- **[P2] Repeat-visit motion.** The hero rise-group entrance replays on every navigation between marketing pages. **Fix**: gate the hero entrance to once per session (sessionStorage) so repeat navigations feel instant, not re-choreographed.

## Persona Red Flags

**Jordan (First-Timer)**: Clicks the prominent "Try the Dashboard" → lands on a login screen with `demo_error=1`. No explanation, no way forward. Likely abandons. Also: the only non-call contact option is raw email.

**Casey (Distracted Mobile)**: Header collapses correctly to a framed hamburger below `xl`; CTAs are reachable. Needs a real-device check that the new advanced ROI sliders and the dual-column reveals stack cleanly and stay thumb-usable at 375px (verified responsive in code, not yet on-device this pass).

**Riley (Stress Tester)**: ROI sliders behave at both extremes (5 and 200 drivers produce sane figures); reduced-motion renders every section fully (no blank reveals); headings tested across breakpoints earlier with no overflow. Holds up well.

## Minor Observations

- The console easter egg is a nice dev-facing touch; confirm it doesn't log in a way that trips a strict CSP.
- `rise-group` uses `animation-fill-mode: both`; on a cold first paint there's a sub-frame where hero content is at opacity 0. Imperceptible in practice, fully visible under reduced-motion.
- The marquee ticker plus the hero choreography plus the booking demo is a lot of simultaneous motion above the fold; it's within budget and reduced-motion-safe, but it's the busiest part of the site.

## Questions to Consider

- What does a prospect actually see when they click "Try the Dashboard" today, and is that the first impression you want?
- Could 2-3 long uppercase headings go sentence-case to give the eye a rest without losing the brutalist voice?
- Is the discovery-call-only contact model deliberate, or is a low-commitment "message us" worth adding for the not-ready-to-call crowd?
