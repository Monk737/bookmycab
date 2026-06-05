---
name: BookMyCab
description: Editorial ink-on-paper with one amber signal — confident, precise, operator-grade.
colors:
  ink: "#0a0a0a"
  paper: "#ffffff"
  dispatch-amber: "#ffd400"
  amber-ink: "#0a0a0a"
  gray-50: "#f7f7f6"
  gray-100: "#ededec"
  gray-200: "#dcdcda"
  gray-300: "#c2c2bf"
  gray-400: "#9a9a96"
  gray-500: "#6f6f6b"
  gray-600: "#4f4f4c"
  gray-700: "#383836"
  gray-800: "#232322"
  gray-900: "#131312"
typography:
  display:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(2.5rem, 5vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Fraunces, ui-serif, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  full: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "5rem"
  section-lg: "7rem"
components:
  button-primary:
    backgroundColor: "{colors.dispatch-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.full}"
    padding: "0 1.75rem"
    height: "3rem"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 1.75rem"
    height: "3rem"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  badge:
    backgroundColor: "{colors.gray-50}"
    textColor: "{colors.gray-600}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.75rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.75rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
---

# Design System: BookMyCab

## 1. Overview

**Creative North Star: "The Dispatch Desk"**

BookMyCab is built for a controller glancing between calls at a busy private-hire desk, and for the owner who wants the marketing site to feel as serious as the trade. Both surfaces share one stance: ink on true-white paper, set in an editorial pairing of Fraunces and Inter, with a single amber signal that means *this is the thing that matters right now*. The system reads as a well-set broadsheet that happens to run software, not a SaaS template with a cab logo bolted on.

Two registers, one language. On the **marketing** surface (design IS the product), Fraunces carries large confident headlines and the amber gets committed moments (a highlighted phrase, a featured tier, an art-directed ink-dark band). On the **product** surface (design SERVES the task), the same palette goes Restrained: Inter carries every heading, label and number; the amber narrows to primary actions, the live state and the one selected thing; density and scannability win. The machinery is never named to customers (the automation engine is "your automation," never "n8n").

This system explicitly rejects the 2026 AI-marketing monoculture: no cream/sand warm-neutral body, no purple-to-blue gradient hero, no hero-metric template, no identical icon-heading-text card grids, no gradient text, no decorative glassmorphism. It also rejects cab-trade kitsch (checkers, cartoon taxis, traffic-light motifs) and the cold corporate-blue enterprise dashboard. Warmth comes from the amber and the serif, never from a tinted background.

**Key Characteristics:**
- True-white paper (#ffffff), near-black ink (#0a0a0a), one amber signal (#ffd400).
- Editorial serif (Fraunces) on brand surfaces; single sans (Inter) inside the product.
- Restrained by default; the amber is rare, so it carries weight.
- Lifted depth: surfaces sit on soft shadows, deepening with interactivity.
- Operator-grade clarity over decoration, on both registers.

## 2. Colors

A monochrome ink-and-paper foundation with a single saturated amber. The neutral ramp is faintly warm-leaning (a whisper of green-grey, not beige) so it never reads as the AI cream default.

### Primary
- **Dispatch Amber** (#ffd400): The one voice. Primary buttons, the highlighted phrase in a hero headline, the featured pricing tier, the healthy "live" status, the current selection and key state indicators. Always paired with **Amber Ink** (#0a0a0a) text on top, never white. On the product surface it is used on roughly 10% or less of any view.

### Neutral
- **Ink** (#0a0a0a): Primary text, the ink-dark art-directed bands, the closing CTA band, button hover fills. The near-black masthead colour.
- **Paper** (#ffffff): The body background and resting card surface. A true off-white at zero chroma, never tinted toward warmth.
- **Gray 600** (#4f4f4c): Default body prose on paper (8:1 contrast). The workhorse reading colour.
- **Gray 500** (#6f6f6b): Secondary text, captions, microcopy on paper (still ≥4.5:1).
- **Gray 200** (#dcdcda): Hairline borders, dividers, the 1px stroke around cards and inputs.
- **Gray 50 / 100** (#f7f7f6 / #ededec): Tonal panel fills, table zebra, secondary surfaces a step off paper.
- **Gray 300 / 400** (#c2c2bf / #9a9a96): Disabled text, placeholder waveforms, inactive strokes. Never body text on paper.
- **Gray 700 / 800 / 900** (#383836 / #232322 / #131312): Borders, chips and panel fills inside ink-dark sections; text colours on amber-free dark surfaces.

### Named Rules
**The One Voice Rule.** Dispatch Amber marks one idea per view: the primary action, or the live signal, or the single highlighted phrase. If two amber things compete for attention on a screen, one is wrong. Its rarity is what makes it read as a signal rather than decoration.

**The Amber-Ink Rule.** Text and icons on top of Dispatch Amber are always Ink (#0a0a0a), never white or grey. White-on-amber fails contrast and looks cheap.

**The True-White Rule.** The body background is #ffffff at chroma 0. Warmth is carried by the amber and the serif, never by tinting the paper toward cream, sand or parchment.

## 3. Typography

**Display Font:** Fraunces (with ui-serif, Georgia, serif)
**Body Font:** Inter (with ui-sans-serif, system-ui, sans-serif)

**Character:** Fraunces is a high-contrast "old style" serif with opinion: it gives headlines the authority of a printed masthead. Inter is a neutral, highly legible workhorse sans that disappears into reading and into dense data. The pairing is a deliberate contrast axis (literate serif against utilitarian sans), not two similar faces competing.

### Hierarchy
- **Display** (Fraunces 600, clamp(2.5rem, 5vw, 4.5rem), line-height 1.02, tracking -0.025em): Marketing hero headlines only. Uses `text-wrap: balance`. Never inside the product UI.
- **Headline** (Fraunces 600, clamp(1.875rem, 3vw, 2.25rem), line-height 1.1): Marketing section headings (h2).
- **Title** (Fraunces 600 on brand / Inter 600 in product, 1.25rem, line-height 1.3): Sub-section and card headings. In the product UI this role is set in Inter, not Fraunces.
- **Body** (Inter 400, 1.0625rem, line-height 1.6): Prose. Capped at 65–75ch measure (`max-w-xl` / `max-w-2xl`). Default colour Gray 600.
- **Label** (Inter 500, 0.75rem, tracking 0.12em, uppercase): Eyebrows, badges, table headers, status text. Reserved for ≤4-word labels.

### Named Rules
**The Sans-In-Product Rule.** Fraunces is forbidden on product UI labels, buttons, table cells and data. Inside the dashboard and admin, one family (Inter) carries everything; the serif is a brand-surface instrument only.

**The Tabular Numbers Rule.** All numeric data (fares, counts, durations, prices, references) uses `tabular-nums` so columns and changing values stay aligned.

## 4. Elevation

Lifted: surfaces rest on soft, low-contrast shadows and deepen as they become more interactive or more important. Shadows are diffuse and neutral (cast in ink at low alpha), never hard or dark "2014 app" drop-shadows. Borders (1px Gray 200) and tonal layering (paper over Gray 50) do the quiet structural work; shadow does the "this is liftable / live / focused" work. One dramatic soft shadow is reserved for the single signature object per page.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgba(10,10,10,0.05)`): Dashboard cards, KPI tiles, panels at rest.
- **Raised** (`box-shadow: 0 4px 12px -2px rgba(10,10,10,0.08)`): Hover state on cards and interactive rows; small popovers.
- **Floating** (`box-shadow: 0 12px 24px -6px rgba(10,10,10,0.12)`): Dropdowns, menus, dialogs.
- **Signature** (`box-shadow: 0 30px 60px -25px rgba(10,10,10,0.35)`): The hero booking-conversation phone, and at most one hero object per page. Never on routine cards.

### Named Rules
**The Earned-Depth Rule.** Depth tracks interactivity. A static card rests at Resting; it climbs to Raised only in response to hover or selection. Decorative shadows on non-interactive elements are forbidden.

**The One Signature Rule.** The Signature shadow appears once per page, on the single most important object. A page with three deep shadows has no hierarchy.

## 5. Components

### Buttons
- **Shape:** Fully rounded pill (`rounded-full`), height 3rem (lg) or 2.5rem (md), horizontal padding 1.75rem (lg) / 1.25rem (md). Tracking is tight.
- **Primary:** Dispatch Amber fill, Amber Ink text. Hover inverts to Ink fill / Paper text over 200ms. This is the booking/CTA button.
- **Secondary:** Paper fill, 1px Ink border, Ink text. Hover fills Ink / Paper text.
- **Ghost:** No border, Ink text, Gray 100 hover fill. On ink-dark surfaces, ghost/secondary become Paper text with a Gray 600 border and a Paper hover fill.
- **Focus:** 2px Ink focus ring with 2px offset (Paper ring with ink offset on dark surfaces). Disabled: 50% opacity, `cursor-not-allowed`.

### Chips / Badges
- **Style:** Pill (`rounded-full`), Gray 50 fill, 1px Gray 200 border, Gray 600 uppercase label text (tracking 0.12em). The editorial eyebrow / metadata label.
- **State:** A "supported / live / healthy" badge swaps to Dispatch Amber fill with Ink text and an Ink border. Status badges in the product use a semantic set (see Do's and Don'ts), distinct from the amber action accent.

### Cards / Containers
- **Corner Style:** Generous. Content cards `rounded-2xl` (1rem) to `rounded-3xl` (1.5rem) on brand; product panels `rounded-xl` (0.75rem).
- **Background:** Paper, over a Gray 50/100 page tone when separation is needed.
- **Shadow Strategy:** Resting at rest, Raised on hover (see Elevation). Marketing grids that read as one object use a 1px Gray 200 gutter (`gap-px` on a Gray 200 bed) rather than per-card shadows.
- **Border:** 1px Gray 200 when not relying on shadow alone. Internal padding 1.75rem–2rem.

### Inputs / Fields
- **Style:** Paper fill, 1px Gray 200 border, `rounded-xl` (0.75rem), generous 0.75rem×1rem padding, `tabular-nums` for numeric entry.
- **Focus:** Border shifts to Ink plus a 2px Ink focus ring; no glow. Placeholder text holds ≥4.5:1 contrast (Gray 500, not a faint grey).

### Navigation
- **Style:** Sticky Paper header with a 1px Gray 100 bottom border and a subtle `backdrop-blur`. Wordmark in Fraunces with an amber full-stop. Nav links Gray 600 → Ink on hover (200ms). Primary CTA sits inline at the right. Mobile collapses to a disclosure menu below the bar.

### Signature Component — Booking Conversation
A WhatsApp-style chat panel that animates a real booking (voice note → trip summary → amber quote → confirmed card → dispatch mirror row) inside a Signature-shadow phone frame. Customer bubbles are amber (Amber Ink text), automation bubbles are Paper with a Gray 200 border. The default / reduced-motion / no-JS state renders the fully completed thread; motion-capable clients reveal it turn by turn on scroll-in and play once. This is the homepage's product proof and the template for any "show the product working" moment.

## 6. Do's and Don'ts

### Do:
- **Do** keep the body background true white (#ffffff) at chroma 0. Carry warmth through Dispatch Amber and Fraunces.
- **Do** put Ink (#0a0a0a) text on every amber surface, never white.
- **Do** hold Dispatch Amber to one idea per view (The One Voice Rule); in the product UI keep it to ~10% of the surface, for primary actions, the live state and the current selection only.
- **Do** set all numbers in `tabular-nums` and cap prose at 65–75ch.
- **Do** use Inter for every heading, label and number inside the dashboard and admin; reserve Fraunces for marketing surfaces.
- **Do** make depth earn its place: Resting at rest, Raised on hover, one Signature shadow per page.
- **Do** give every animation a `prefers-reduced-motion` fallback, and make reveals enhance an already-visible default (never gate content behind a transition).
- **Do** say "your automation" / "BookMyCab Automation Engine"; never expose the engine's real name.

### Don't:
- **Don't** tint the background toward cream, sand, beige or parchment. That warm-neutral band is the saturated AI default; it is forbidden here.
- **Don't** ship a purple/blue gradient hero, the hero-metric template (big number + small label + supporting stats), or identical icon-heading-text card grids.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism.
- **Don't** use `border-left`/`border-right` greater than 1px as a coloured accent stripe on cards, callouts or alerts.
- **Don't** put a tiny uppercase tracked eyebrow above every section, or numbered `01 / 02 / 03` markers on sections that are not a genuine ordered sequence.
- **Don't** use cab-trade kitsch (checkerboard patterns, cartoon taxis, emoji cars, traffic-light motifs) or revert the dashboard to the cold corporate-blue / Fira-Code look of the stale `design-system/` MASTER doc.
- **Don't** set product UI labels, buttons or data in Fraunces, and don't let white sit on amber.
- **Don't** write marketing-buzzword copy (streamline, supercharge, seamless, world-class) or use em dashes; name what the product literally does.
