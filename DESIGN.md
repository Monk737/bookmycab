---
name: BookMyCab
description: Neo-Brutalism for the dispatch desk — hard ink frames, clashing flat color, no apology.
colors:
  ink: "#0a0a0a"
  paper: "#ffffff"
  canvas: "#f4f3ec"
  brut-yellow: "#ffd400"
  brut-blue: "#2f6bff"
  brut-lime: "#c6f24e"
  brut-pink: "#ff7ac0"
  brut-red: "#ff5247"
  brut-violet: "#b794ff"
  brut-cyan: "#5fd9e8"
  brut-orange: "#ff8a3c"
  brut-blue-deep: "#1d3fd6"
  brut-violet-deep: "#6d28d9"
  brut-red-deep: "#c81e1e"
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
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.03em"
    textTransform: "uppercase"
  headline:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Urbanist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
    textTransform: "uppercase"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  none: "0"
  chunk: "6px"
  full: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "5rem"
  section-lg: "7rem"
shadows:
  brut-xs: "1px 1px 0 0 #0a0a0a"
  brut-sm: "2px 2px 0 0 #0a0a0a"
  brut: "4px 4px 0 0 #0a0a0a"
  brut-lg: "6px 6px 0 0 #0a0a0a"
  brut-xl: "10px 10px 0 0 #0a0a0a"
components:
  button-primary:
    backgroundColor: "{colors.brut-yellow}"
    textColor: "{colors.ink}"
    border: "3px solid {colors.ink}"
    shadow: "{shadows.brut}"
    rounded: "{rounded.none}"
    padding: "0 1.5rem"
    height: "3rem"
  button-primary-hover:
    transform: "translate(-2px,-2px)"
    shadow: "{shadows.brut-lg}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "3px solid {colors.ink}"
    shadow: "{shadows.brut}"
    rounded: "{rounded.none}"
  badge:
    backgroundColor: "{colors.brut-yellow}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.2rem 0.6rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "3px solid {colors.ink}"
    shadow: "{shadows.brut}"
    rounded: "{rounded.none}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "3px solid {colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
---

# Design System: BookMyCab — Neo-Brutalism

## 1. Overview

**Creative North Star: "The Dispatch Desk, Cranked Up."**

BookMyCab is operational software for a busy private-hire desk, drawn in Neo-Brutalism: hard 3px ink frames, flat clashing color blocks, hard offset shadows with no blur, sharp corners, and heavy uppercase type. Nothing is soft, nothing fades, nothing pretends to be glass. Every surface looks like it was screen-printed and bolted to the wall: a thing you press, not a thing you admire. The aesthetic is loud and confident on purpose, the opposite of the interchangeable SaaS-cream landing page.

Two registers, one language. On the **marketing** surface (design IS the product), the color clashes hard, headlines run huge and uppercase, blocks overlap on their shadows, and a marquee ticker spells out the trade. On the **product** surface (design SERVES the task), the same hard frames and shadows organize dense data: white cards on the flat canvas, ink borders dividing everything, JetBrains Mono carrying figures, and color narrowed to status and the one primary action. Density still wins on dashboards; the brutalism is in the structure, not in drowning the data in color.

The machinery is never named to customers (the automation engine is "your automation," never "n8n"). The product is **BookMyCab** everywhere.

**Key Characteristics:**
- Hard 3px ink frame on nearly everything; flat off-white canvas (#f4f3ec) so white cards pop.
- Hard offset shadows (`Npx Npx 0 0 #0a0a0a`), zero blur. Objects sit ON their shadow and slam down when pressed.
- Sharp corners (radius 0) as the default. One 6px "chunk" radius is the only softening allowed.
- Clashing flat color — yellow, blue, lime, pink, red, violet, cyan, orange — each with INK text and an ink border.
- Heavy uppercase Urbanist (800) for display; JetBrains Mono for data; Stalinist One for the wordmark.

## 2. Colors

A flat clashing palette over an ink-and-paper structure. Color arrives in solid blocks, never gradients, never tints-for-mood. The off-white canvas is the only non-white neutral surface.

### Structure
- **Ink** (#0a0a0a): Every border, every shadow, all body and heading text, dark sidebars and bands. The system is drawn in ink first.
- **Paper** (#ffffff): Cards, panels, inputs, the resting interactive surface.
- **Canvas** (#f4f3ec): The page background. Flat, faintly warm, so white cards and ink frames read as objects on a wall.

### Clashing palette (bright fills → INK text + ink border)
- **Yellow** (#ffd400): The brand anchor and primary action. Ink text always, never white (hard constraint). Booking/CTA buttons, the highlighted phrase, the live/healthy state, the current selection.
- **Blue** (#2f6bff) / **Blue-deep** (#1d3fd6): Information, links-as-blocks, secondary category. Deep variant takes white text for filled buttons/sidebars.
- **Lime** (#c6f24e): "Go", success, completed, healthy. Ink text.
- **Pink** (#ff7ac0): Demo surface accent, highlights, playful tags. Ink text.
- **Red** (#ff5247) / **Red-deep** (#c81e1e): Warnings and errors as blocks (ink text); deep variant for destructive filled buttons (white text).
- **Violet** (#b794ff) / **Violet-deep** (#6d28d9): Dispatched/managed states, admin accent. Deep variant white text.
- **Cyan** (#5fd9e8): Admin/console accent, info chips. Ink text.
- **Orange** (#ff8a3c): Building/in-progress, attention. Ink text.

### Named Rules
**The Ink-Frame Rule.** Almost everything structural gets a 3px (2px for small chips) solid ink border. The frame is the system. A surface with no border had better be a full-bleed color band that needs none.

**The Ink-On-Bright Rule.** Text on any bright fill (yellow, lime, pink, cyan, orange, and the bright blue/red/violet) is Ink (#0a0a0a), never white. White text is reserved for ink-dark surfaces and the three `-deep` fills only. Yellow with white text is forbidden and fails contrast.

**The Clash-With-Intent Rule.** Color clashes loudly but each color still means something (yellow = primary/live, blue = info, lime = success, red = error, violet = dispatched, orange = building). On a dense product view, hold the loud fills to status + the one primary action; let ink frames and white cards do the structural work so data stays readable.

**The Canvas Rule.** The page background is the flat canvas (#f4f3ec), not white and not a brand tint. White is for cards that sit on it.

## 3. Typography

**Primary Font:** Urbanist (with ui-sans-serif, system-ui, sans-serif), self-hosted, weights 400–800
**Secondary Font:** JetBrains Mono (data only)
**Wordmark Font:** Stalinist One (the blocky BookMyCab logotype only)

**Character:** Urbanist is a geometric sans pushed to its heaviest, most blunt register here: display and headlines run at weight 800, uppercase, with tight tracking, set huge. Hierarchy comes from weight + size + case, not from a second display face. JetBrains Mono carries genuine data so figures read as machine-exact. Stalinist One — already blocky and brutalist — is the wordmark and nothing else.

### Hierarchy
- **Display** (Urbanist 800, clamp(2.75rem, 6vw, 5rem), line-height 0.98, tracking -0.03em, UPPERCASE): Marketing hero headlines. `text-wrap: balance`.
- **Headline** (Urbanist 800, clamp(1.875rem, 3.5vw, 2.5rem), line-height 1.04): Section headings (h2). May be uppercase or sentence case.
- **Title** (Urbanist 700, 1.25rem): Card and sub-section headings, both registers.
- **Body** (Urbanist 400, 1.0625rem, line-height 1.6): Prose. Capped at 65–75ch. Default color Ink or Gray 600.
- **Label** (Urbanist 700, 0.75rem, tracking 0.08em, UPPERCASE): Eyebrows, badges, table headers, nav, status text. ≤4-word labels.
- **Mono** (JetBrains Mono 500, 0.875rem): Fares, references (BMC-4827), IDs, durations, table figures.

### Named Rules
**The Mono-For-Data Rule.** JetBrains Mono is reserved for genuine technical data: fares, references, IDs, durations, aligned table figures. Never prose, labels or headings.

**The Tabular-Numbers Rule.** All numeric data uses `tabular-nums` so columns and changing values stay aligned.

**The Uppercase-Heavy Rule.** Display headlines and labels run uppercase at weight 700–800. Body prose never does (unreadable at body size).

## 4. Elevation

There is no soft elevation. Depth is a **hard offset shadow**: a solid ink rectangle cast down-right with zero blur. Objects literally sit on top of their shadow. Interaction is physical: an interactive object lifts toward the cursor (shadow grows) on hover and slams flush (shadow shrinks to nothing) on press.

### Shadow Vocabulary
- **brut-xs** (`1px 1px 0 0 #0a0a0a`): pressed/active state, tiny chips.
- **brut-sm** (`2px 2px 0 0 #0a0a0a`): dense table rows, small controls at rest.
- **brut** (`4px 4px 0 0 #0a0a0a`): default for cards, buttons, panels at rest.
- **brut-lg** (`6px 6px 0 0 #0a0a0a`): hover lift of an interactive object; small popovers.
- **brut-xl** (`10px 10px 0 0 #0a0a0a`): the one signature object per page (hero phone, featured tier).

### Named Rules
**The Press Rule.** Interactive objects use `.brut-press`: rest at `brut`, hover translates `(-2px,-2px)` to `brut-lg`, active translates `(2px,2px)` to `brut-xs`. It must feel like a physical button. Honor `prefers-reduced-motion` (no transform).

**The No-Blur Rule.** Every shadow is `... 0 0 #0a0a0a`. A blurred or colored-soft shadow is forbidden; it breaks the whole language.

**The One-Signature Rule.** `brut-xl` appears once per page, on the single most important object.

## 5. Components

### Buttons
- **Shape:** Rectangular, sharp corners (radius 0), 3px ink border, `brut` shadow, `.brut-press`. Height 3rem (lg) / 2.5rem (md). Heavy label (weight 700), often uppercase.
- **Primary:** Yellow fill, Ink text. The booking/CTA button.
- **Secondary:** Paper fill, Ink text, ink frame.
- **Tertiary/category:** A clashing fill (blue/lime/pink) with Ink text for non-primary but loud actions; deep fills (blue-deep/red-deep) take white text.
- **Ghost:** No frame/shadow, Ink text, underline or gray-100 hover. For low-key inline actions only.
- **Focus:** `.brut-focus` — 3px ink outline, 2px offset (paper outline on ink surfaces). Disabled: 50% opacity, no shadow, `cursor-not-allowed`.

### Chips / Badges
- **Style:** Rectangular, 2px ink border, flat fill, Ink text, uppercase weight-700 label. The eyebrow / metadata / status unit.
- **Status set:** semantic fill by meaning (live/completed → yellow or lime, info/confirmed → blue, building → orange, uat/abandoned → yellow, dispatched/managed → violet, error → red, neutral/stopped → gray-200). Always fill + ink border + label text + dot, so status never rides on color alone (color-blind safe).

### Cards / Containers
- **Style:** `.brut-card` — paper fill, 3px ink frame, `brut` shadow, sharp corners. Interactive cards add `.brut-press`.
- **No nested cards.** Inside a card, divide with 2–3px ink rules or flat color sub-blocks, never another framed-and-shadowed card.
- **Grids that read as one object:** lay cards on an ink bed with `gap-[3px]` (hairline ink grid) rather than scattering individual shadows.

### Inputs / Fields
- **Style:** Paper fill, 3px ink border, sharp corners, generous padding, `tabular-nums` for numeric entry, `brut-sm` resting shadow optional.
- **Focus:** border stays ink, add `.brut-focus` 3px outline. Error: red fill tint + red-deep text + ink border. Placeholder Gray 500 (≥4.5:1).

### Navigation
- **Marketing header:** Solid paper bar, 3px ink bottom border (not a hairline). Stalinist One wordmark with a yellow block accent. Nav links uppercase weight-700, Ink, yellow underline-block on hover. Primary CTA is a framed yellow button inline. Mobile collapses to a framed disclosure panel.
- **Product sidebars:** Solid ink-black panel with a 3px ink edge. Active item is a full flat color block (tenant = yellow/ink, admin = cyan/ink, demo = pink/ink) with ink text; inactive items are paper-on-ink text that fill a gray block on hover. Each product surface is told apart by its accent color, not by changing the structure.

### Signature Component — Booking Conversation
A WhatsApp-style chat that animates a real booking (voice note → trip summary → yellow quote → confirmed card → dispatch mirror row) inside a `brut-xl` framed phone. Customer bubbles are yellow (ink text, ink frame); automation bubbles are paper with an ink frame. Default / reduced-motion / no-JS renders the completed thread; motion-capable clients reveal it turn by turn, once. The template for any "show the product working" moment.

## 6. Do's and Don'ts

### Do:
- **Do** frame structural surfaces with a 3px (or 2px small) solid ink border.
- **Do** cast hard offset shadows (`Npx Npx 0 0 #0a0a0a`), zero blur, and make interaction physical with `.brut-press`.
- **Do** keep corners sharp (radius 0); reach for the 6px chunk only as a rare softening.
- **Do** put Ink text on every bright fill; reserve white text for ink-dark surfaces and the three `-deep` fills.
- **Do** keep the page background the flat canvas (#f4f3ec); white is for cards.
- **Do** let color still mean something (status, primary action); on dense product views hold the loud fills back and let ink frames carry the structure.
- **Do** set all numbers in `tabular-nums`, reserve JetBrains Mono for data, cap prose at 65–75ch.
- **Do** give every animation a `prefers-reduced-motion` fallback and keep reveals enhancing an already-visible default.
- **Do** say "your automation" / "BookMyCab Automation Engine"; never expose the engine's real name.

### Don't:
- **Don't** use soft/blurred/colored shadows, glassmorphism, or rounded-everything; this is the opposite system.
- **Don't** put white (or grey) text on yellow, or on any bright fill — fails contrast and the Ink-On-Bright Rule.
- **Don't** use gradients, gradient text, or tint-for-mood backgrounds; color arrives in flat blocks.
- **Don't** nest a framed-and-shadowed card inside another; divide with ink rules or flat sub-blocks instead.
- **Don't** drown a dense dashboard in clashing fills; structure with ink frames, color the status and the one primary action.
- **Don't** use cab-trade kitsch (checkerboard, cartoon taxis, emoji cars, traffic lights) or revert to the cold corporate-blue / soft-editorial look.
- **Don't** set prose, labels, buttons or headings in JetBrains Mono (data only), and don't write marketing-buzzword copy or use em dashes; name what the product literally does.
