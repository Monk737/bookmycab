# Pricing Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single fleet-tier pricing block with three product pricing sections — Chat, AI Voice Booking, and Double Decker (bundle) — each with Ignition / In Motion / Full Throttle tiers, plus an extra voice-credit line, with GBP as the source of truth and EUR/USD derived from a **live FX API** (with a safe fallback).

**Architecture:** All canonical prices live in GBP in `src/lib/marketing/pricing.ts`. A new server-side module `src/lib/marketing/fx.ts` fetches GBP→EUR/USD rates once per day (Next.js fetch revalidation) with a hardcoded fallback so the page never breaks. The pricing page is a server component that fetches rates and passes them as a prop into client components, which own the currency toggle and render the three sections. Display = `convert(gbp, currency, rates)` then `formatPrice`.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript, Tailwind v4, Vitest + Testing Library. Neo-Brutalism visual system per `src/app/globals.css` (`border-[3px] border-ink`, `shadow-brut`, `bg-brut-cyan/lime/pink/yellow`, Fraunces display + Inter body).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/marketing/pricing.ts` | Canonical GBP price data for all three products + setup fees + extra credit + `convert`/`formatPrice` helpers | Rewrite |
| `src/lib/marketing/fx.ts` | Live FX rate fetch (`getFxRates`) + pure `parseFxResponse` + `FX_FALLBACK` | Create |
| `src/components/marketing/pricing-sections.tsx` | Client orchestrator: owns currency state + toggle, renders Chat / Voice / Double Decker groups + setup-fee/credit footer | Create (replaces `pricing-cards.tsx`) |
| `src/components/marketing/pricing-cards.tsx` | Old single-tier block | Delete |
| `src/components/marketing/currency-toggle.tsx` | GBP/EUR/USD segmented switch | Unchanged (reused) |
| `src/components/marketing/pricing-roi.tsx` | ROI calculator | Realign tier numbers to new Chat tiers + consume `rates` |
| `src/app/(marketing)/pricing/page.tsx` | Pricing page — fetch rates server-side, pass to components, updated copy | Modify |
| `tests/pricing.test.ts` | Unit tests for the pricing data model + helpers | Rewrite |
| `tests/fx.test.ts` | Unit tests for FX parsing + fallback | Create |
| `tests/pricing-sections.test.tsx` | Render test for the three sections | Create |

> **Note for the engineer:** Per project rule in `CLAUDE.md`, never let "n8n" appear on customer-facing copy, and always say "BookMyCab". The pricing page is brand-register marketing copy. Keep the existing Neo-Brutalism classes; do not invent new colors.

---

### Task 1: Pricing data model (GBP source of truth)

**Files:**
- Rewrite: `src/lib/marketing/pricing.ts`
- Rewrite: `tests/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/pricing.test.ts` with:

```ts
/**
 * Tests for src/lib/marketing/pricing.ts
 *
 * GBP is the source of truth. EUR/USD are derived at display time from live FX
 * rates (see fx.ts), so this file tests GBP data + the convert/format helpers.
 */
import { describe, it, expect } from "vitest";
import {
  CHAT_TIERS,
  CHAT_SETUP_FEE_GBP,
  VOICE_TIERS,
  VOICE_SETUP_GBP,
  BUNDLE_TIERS,
  BUNDLE_SETUP_GBP,
  EXTRA_CALL_PRICE_GBP,
  CURRENCIES,
  BASE_CURRENCY,
  convert,
  formatPrice,
  priceFor,
} from "@/lib/marketing/pricing";

const RATES = { GBP: 1, EUR: 1.18, USD: 1.27 } as const;

describe("Chat tiers", () => {
  it("has Ignition / In Motion / Full Throttle in order", () => {
    expect(CHAT_TIERS.map((t) => t.key)).toEqual([
      "ignition",
      "in_motion",
      "full_throttle",
    ]);
  });
  it("Ignition: £499 single / £899 bundle / max 2 channels / ≤50 fleet", () => {
    const t = CHAT_TIERS[0];
    expect(t.singleGbp).toBe(499);
    expect(t.bundleGbp).toBe(899);
    expect(t.bundleMaxChannels).toBe(2);
    expect(t.contactOnly).toBe(false);
    expect(t.fleet).toContain("50");
  });
  it("In Motion: £999 single / £1799 bundle / 51–100 fleet / featured", () => {
    const t = CHAT_TIERS[1];
    expect(t.singleGbp).toBe(999);
    expect(t.bundleGbp).toBe(1799);
    expect(t.bundleMaxChannels).toBe(2);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: contact only, no fixed price", () => {
    const t = CHAT_TIERS[2];
    expect(t.contactOnly).toBe(true);
    expect(t.singleGbp).toBeNull();
    expect(t.bundleGbp).toBeNull();
  });
  it("Chat setup fee is £1000", () => {
    expect(CHAT_SETUP_FEE_GBP).toBe(1000);
  });
});

describe("Voice tiers", () => {
  it("Ignition: 1500 calls / £1199 / 1 number 1 agent", () => {
    const t = VOICE_TIERS[0];
    expect(t.callsPerMonth).toBe(1500);
    expect(t.priceGbp).toBe(1199);
    expect(t.config).toMatch(/1 number/i);
  });
  it("In Motion: 2250 calls / £1599 / featured", () => {
    const t = VOICE_TIERS[1];
    expect(t.callsPerMonth).toBe(2250);
    expect(t.priceGbp).toBe(1599);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: 3000 calls / £1999", () => {
    const t = VOICE_TIERS[2];
    expect(t.callsPerMonth).toBe(3000);
    expect(t.priceGbp).toBe(1999);
  });
  it("Voice setup: £1000 one agent / £1500 two agents / £500 second-agent add-on", () => {
    expect(VOICE_SETUP_GBP.oneAgent).toBe(1000);
    expect(VOICE_SETUP_GBP.twoAgents).toBe(1500);
    expect(VOICE_SETUP_GBP.secondAgentAddOn).toBe(500);
  });
});

describe("Double Decker bundle tiers", () => {
  it("Ignition: single £1599 / bundle £1999", () => {
    const t = BUNDLE_TIERS[0];
    expect(t.single.priceGbp).toBe(1599);
    expect(t.bundle.priceGbp).toBe(1999);
  });
  it("In Motion: single £2499 / bundle £3199 / featured", () => {
    const t = BUNDLE_TIERS[1];
    expect(t.single.priceGbp).toBe(2499);
    expect(t.bundle.priceGbp).toBe(3199);
    expect(t.featured).toBe(true);
  });
  it("Full Throttle: single £2999 / bundle £3799", () => {
    const t = BUNDLE_TIERS[2];
    expect(t.single.priceGbp).toBe(2999);
    expect(t.bundle.priceGbp).toBe(3799);
  });
  it("Bundle setup: £1500 one voice agent / £2000 two voice agents", () => {
    expect(BUNDLE_SETUP_GBP.oneVoiceAgent).toBe(1500);
    expect(BUNDLE_SETUP_GBP.twoVoiceAgents).toBe(2000);
  });
});

describe("Extra voice credit", () => {
  it("is £0.90 per call", () => {
    expect(EXTRA_CALL_PRICE_GBP).toBe(0.9);
  });
});

describe("Currencies", () => {
  it("GBP/EUR/USD with GBP as base", () => {
    expect(CURRENCIES).toEqual(["GBP", "EUR", "USD"]);
    expect(BASE_CURRENCY).toBe("GBP");
  });
});

describe("convert()", () => {
  it("GBP is identity", () => {
    expect(convert(499, "GBP", RATES)).toBe(499);
  });
  it("EUR multiplies by the EUR rate", () => {
    expect(convert(1000, "EUR", RATES)).toBeCloseTo(1180, 5);
  });
  it("USD multiplies by the USD rate", () => {
    expect(convert(1000, "USD", RATES)).toBeCloseTo(1270, 5);
  });
  it("falls back to 1x when a rate is missing", () => {
    expect(convert(500, "USD", { GBP: 1, EUR: 1.18 } as never)).toBe(500);
  });
});

describe("formatPrice()", () => {
  it("GBP 499 → £499 (no decimals by default)", () => {
    expect(formatPrice("GBP", 499)).toBe("£499");
  });
  it("EUR 1180 → €1,180", () => {
    expect(formatPrice("EUR", 1180)).toBe("€1,180");
  });
  it("USD 1270 → $1,270", () => {
    expect(formatPrice("USD", 1270)).toBe("$1,270");
  });
  it("rounds to whole numbers by default", () => {
    expect(formatPrice("GBP", 1180.6)).toBe("£1,181");
  });
  it("supports 2 decimals for the per-call credit", () => {
    expect(formatPrice("GBP", 0.9, { decimals: 2 })).toBe("£0.90");
  });
});

describe("priceFor()", () => {
  it("converts then formats in one call", () => {
    expect(priceFor(1000, "EUR", RATES)).toBe("€1,180");
  });
  it("supports decimals for credit", () => {
    expect(priceFor(0.9, "USD", RATES, 2)).toBe("$1.14");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pricing.test.ts`
Expected: FAIL — imports like `CHAT_TIERS`, `convert`, `priceFor` do not exist yet.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `src/lib/marketing/pricing.ts` with:

```ts
/**
 * BookMyCab pricing model.
 *
 * GBP is the single source of truth. All prices below are MONTHLY in GBP,
 * excluding VAT, EXCEPT the one-time setup fees and the per-call credit price.
 * EUR/USD figures shown on the page are derived at render time from live FX
 * rates (see ./fx.ts) via convert()/priceFor(); they are never stored here.
 *
 * Three products:
 *   1. Chat (multi-channel chatbot)
 *   2. AI Voice Booking (priced by monthly call allowance)
 *   3. Double Decker (Chat + AI Voice bundle)
 */

export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCIES = ["GBP", "EUR", "USD"] as const satisfies readonly Currency[];

/** Prices are authored in this currency; everything else is derived. */
export const BASE_CURRENCY: Currency = "GBP";

export type TierKey = "ignition" | "in_motion" | "full_throttle";

/* ----------------------------------------------------------------------------
   1. CHAT
   -------------------------------------------------------------------------- */

export interface ChatTier {
  key: TierKey;
  name: string;
  fleet: string;
  /** GBP/month for a single channel, or null when contact-only. */
  singleGbp: number | null;
  /** GBP/month for the channel bundle, or null when contact-only. */
  bundleGbp: number | null;
  /** Maximum channels included in the bundle rate, or null when contact-only. */
  bundleMaxChannels: number | null;
  contactOnly: boolean;
  featured?: boolean;
}

export const CHAT_TIERS: ChatTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    fleet: "Up to 50 drivers / fleet",
    singleGbp: 499,
    bundleGbp: 899,
    bundleMaxChannels: 2,
    contactOnly: false,
  },
  {
    key: "in_motion",
    name: "In Motion",
    fleet: "51–100 drivers / fleet",
    singleGbp: 999,
    bundleGbp: 1799,
    bundleMaxChannels: 2,
    contactOnly: false,
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    fleet: "101+ drivers, or 4+ channels / custom",
    singleGbp: null,
    bundleGbp: null,
    bundleMaxChannels: null,
    contactOnly: true,
  },
];

/** One-time Chat agent setup fee, GBP. */
export const CHAT_SETUP_FEE_GBP = 1000;

/* ----------------------------------------------------------------------------
   2. AI VOICE BOOKING
   -------------------------------------------------------------------------- */

export interface VoiceTier {
  key: TierKey;
  name: string;
  callsPerMonth: number;
  priceGbp: number;
  /** Human-readable agent/number configuration, e.g. "1 number · 1 agent". */
  config: string;
  featured?: boolean;
}

export const VOICE_TIERS: VoiceTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    callsPerMonth: 1500,
    priceGbp: 1199,
    config: "1 number · 1 agent",
  },
  {
    key: "in_motion",
    name: "In Motion",
    callsPerMonth: 2250,
    priceGbp: 1599,
    config: "2 numbers · 2 agents",
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    callsPerMonth: 3000,
    priceGbp: 1999,
    config: "2 numbers · 2 agents",
  },
];

/** One-time AI Voice agent setup fees, GBP. */
export const VOICE_SETUP_GBP = {
  oneAgent: 1000,
  twoAgents: 1500,
  secondAgentAddOn: 500,
} as const;

/* ----------------------------------------------------------------------------
   3. DOUBLE DECKER (Chat + AI Voice)
   -------------------------------------------------------------------------- */

export interface BundleRow {
  label: string;
  priceGbp: number;
}

export interface BundleTier {
  key: TierKey;
  name: string;
  /** Single chat channel + voice calls. */
  single: BundleRow;
  /** Bundle chat (2 channels) + voice calls. */
  bundle: BundleRow;
  featured?: boolean;
}

export const BUNDLE_TIERS: BundleTier[] = [
  {
    key: "ignition",
    name: "Ignition",
    single: {
      label: "Single chat channel (up to 50 fleet) + 1,500 calls/mo",
      priceGbp: 1599,
    },
    bundle: {
      label: "Bundle chat (2 channels) + 2,250 calls/mo",
      priceGbp: 1999,
    },
  },
  {
    key: "in_motion",
    name: "In Motion",
    single: {
      label: "Single chat channel (51–100 fleet) + 2,250 calls/mo",
      priceGbp: 2499,
    },
    bundle: {
      label: "Bundle chat (2 channels) + 2,250 calls/mo",
      priceGbp: 3199,
    },
    featured: true,
  },
  {
    key: "full_throttle",
    name: "Full Throttle",
    single: {
      label: "Single chat channel (101+ fleet) + 3,000 calls/mo",
      priceGbp: 2999,
    },
    bundle: {
      label: "Bundle chat (2 channels) + 3,000 calls/mo",
      priceGbp: 3799,
    },
  },
];

/** One-time Chat + AI Voice bundle setup fees, GBP. */
export const BUNDLE_SETUP_GBP = {
  oneVoiceAgent: 1500,
  twoVoiceAgents: 2000,
} as const;

/* ----------------------------------------------------------------------------
   EXTRA VOICE CREDIT
   -------------------------------------------------------------------------- */

/** Pay-as-you-go voice credit, GBP per call (1 credit = £0.90). */
export const EXTRA_CALL_PRICE_GBP = 0.9;

/* ----------------------------------------------------------------------------
   FORMAT / CONVERT HELPERS
   -------------------------------------------------------------------------- */

const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

/** Convert a GBP amount into `currency` using `rates` (rates[GBP] === 1). */
export function convert(
  amountGbp: number,
  currency: Currency,
  rates: Record<Currency, number>,
): number {
  const rate = rates[currency];
  return amountGbp * (typeof rate === "number" && rate > 0 ? rate : 1);
}

/**
 * Format a monetary amount for display: symbol + grouped digits.
 * Default 0 decimals (plan prices); pass { decimals: 2 } for the per-call price.
 * Non-finite/negative amounts coerce to 0 so we never render "£NaN".
 */
export function formatPrice(
  currency: Currency,
  amount: number,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 0;
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
  return `${CURRENCY_SYMBOL[currency]}${formatted}`;
}

/** Convenience: convert a GBP amount and format it in one call. */
export function priceFor(
  amountGbp: number,
  currency: Currency,
  rates: Record<Currency, number>,
  decimals = 0,
): string {
  return formatPrice(currency, convert(amountGbp, currency, rates), { decimals });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/pricing.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/pricing.ts tests/pricing.test.ts
git commit -m "feat(pricing): GBP-canonical data model for Chat / Voice / Double Decker"
```

---

### Task 2: Live FX rate module

**Files:**
- Create: `src/lib/marketing/fx.ts`
- Create: `tests/fx.test.ts`

> Uses the free, no-key Frankfurter API (ECB rates): `https://api.frankfurter.app/latest?base=GBP&symbols=EUR,USD`. Cached for 24h via Next.js fetch revalidation. Any failure (non-200, network error, malformed body) returns `FX_FALLBACK` so the page always renders.

- [ ] **Step 1: Write the failing test**

Create `tests/fx.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { parseFxResponse, getFxRates, FX_FALLBACK } from "@/lib/marketing/fx";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("parseFxResponse()", () => {
  it("extracts EUR/USD and pins GBP to 1", () => {
    const out = parseFxResponse({ base: "GBP", rates: { EUR: 1.18, USD: 1.27 } });
    expect(out).toEqual({ GBP: 1, EUR: 1.18, USD: 1.27 });
  });
  it("returns null when rates are missing", () => {
    expect(parseFxResponse({ base: "GBP" })).toBeNull();
  });
  it("returns null when a rate is non-numeric", () => {
    expect(parseFxResponse({ rates: { EUR: "x", USD: 1.27 } })).toBeNull();
  });
  it("returns null for non-object input", () => {
    expect(parseFxResponse("nope")).toBeNull();
  });
});

describe("getFxRates()", () => {
  it("returns parsed live rates on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ rates: { EUR: 1.19, USD: 1.28 } }),
      })),
    );
    await expect(getFxRates()).resolves.toEqual({ GBP: 1, EUR: 1.19, USD: 1.28 });
  });
  it("falls back when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(getFxRates()).resolves.toEqual(FX_FALLBACK);
  });
  it("falls back when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(getFxRates()).resolves.toEqual(FX_FALLBACK);
  });
  it("falls back when the body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ rates: {} }) })),
    );
    await expect(getFxRates()).resolves.toEqual(FX_FALLBACK);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/fx.test.ts`
Expected: FAIL — `@/lib/marketing/fx` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/marketing/fx.ts`:

```ts
/**
 * Live GBP→EUR/USD foreign-exchange rates for the pricing page.
 *
 * Source: Frankfurter (https://www.frankfurter.app), free, no API key, ECB data.
 * Cached 24h via Next.js fetch revalidation. On ANY failure we return
 * FX_FALLBACK so the pricing page always renders sane numbers.
 *
 * Call getFxRates() from a SERVER component only, then pass the result down to
 * client components as a plain prop.
 */
import type { Currency } from "@/lib/marketing/pricing";

/** Conservative manual snapshot; update if the API is ever retired. */
export const FX_FALLBACK: Record<Currency, number> = {
  GBP: 1,
  EUR: 1.18,
  USD: 1.27,
};

const FX_URL = "https://api.frankfurter.app/latest?base=GBP&symbols=EUR,USD";

/** Pure parser — extracted so it is unit-testable without network. */
export function parseFxResponse(data: unknown): Record<Currency, number> | null {
  if (!data || typeof data !== "object") return null;
  const rates = (data as { rates?: Record<string, unknown> }).rates;
  if (!rates || typeof rates !== "object") return null;
  const eur = (rates as Record<string, unknown>).EUR;
  const usd = (rates as Record<string, unknown>).USD;
  if (typeof eur !== "number" || typeof usd !== "number") return null;
  return { GBP: 1, EUR: eur, USD: usd };
}

export async function getFxRates(): Promise<Record<Currency, number>> {
  try {
    const res = await fetch(FX_URL, { next: { revalidate: 86400 } });
    if (!res.ok) return FX_FALLBACK;
    const parsed = parseFxResponse(await res.json());
    return parsed ?? FX_FALLBACK;
  } catch {
    return FX_FALLBACK;
  }
}
```

> If `tsc` complains about `{ next: { revalidate } }` not being on `RequestInit`, that property is added by Next.js's global fetch types and resolves under `next build`/`next dev`. If it fails under bare `tsc --noEmit`, change the option to `{ next: { revalidate: 86400 } } as RequestInit`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/fx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/fx.ts tests/fx.test.ts
git commit -m "feat(pricing): live FX rates with safe fallback (Frankfurter)"
```

---

### Task 3: Three-section pricing component

**Files:**
- Create: `src/components/marketing/pricing-sections.tsx`
- Delete: `src/components/marketing/pricing-cards.tsx`
- Create: `tests/pricing-sections.test.tsx`

> This client component owns the currency state + `CurrencyToggle` (reused unchanged) and renders three product groups. It receives `rates` as a prop from the server page. All displayed money goes through `priceFor(...)`.

- [ ] **Step 1: Write the failing render test**

Create `tests/pricing-sections.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingSections } from "@/components/marketing/pricing-sections";
import { FX_FALLBACK } from "@/lib/marketing/fx";

describe("PricingSections (default GBP)", () => {
  it("renders the three product section headings", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByText(/^Chat$/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Voice Booking/i)).toBeInTheDocument();
    expect(screen.getByText(/Double Decker/i)).toBeInTheDocument();
  });

  it("renders chat Ignition single-channel price in GBP", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/£499/).length).toBeGreaterThan(0);
  });

  it("renders a voice tier price in GBP", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/£1,199/).length).toBeGreaterThan(0);
  });

  it("renders the extra voice credit price", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByText(/£0\.90/)).toBeInTheDocument();
  });

  it("renders the currency toggle", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByRole("radiogroup", { name: /currency/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/pricing-sections.test.tsx`
Expected: FAIL — `pricing-sections` module not found.

- [ ] **Step 3: Write the component**

Create `src/components/marketing/pricing-sections.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  CHAT_TIERS,
  CHAT_SETUP_FEE_GBP,
  VOICE_TIERS,
  VOICE_SETUP_GBP,
  BUNDLE_TIERS,
  BUNDLE_SETUP_GBP,
  EXTRA_CALL_PRICE_GBP,
  priceFor,
  type Currency,
  type ChatTier,
  type VoiceTier,
  type BundleTier,
} from "@/lib/marketing/pricing";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { Badge } from "@/components/marketing/ui/badge";

type Rates = Record<Currency, number>;

const CARD_BG = ["bg-brut-cyan", "bg-brut-lime", "bg-brut-pink"] as const;

function SectionHeading({ kicker, title, blurb }: { kicker: string; title: string; blurb: string }) {
  return (
    <div className="max-w-2xl">
      <Badge>{kicker}</Badge>
      <h3 className="mt-4 font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-3xl">
        {title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-gray-700">{blurb}</p>
    </div>
  );
}

/** A single priced row inside a card. */
function PriceRow({
  label,
  priceGbp,
  currency,
  rates,
  note,
}: {
  label: string;
  priceGbp: number | null;
  currency: Currency;
  rates: Rates;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink py-4 first:border-t-0 first:pt-0">
      <div>
        <p className="font-display text-base font-bold text-ink">{label}</p>
        {note ? <p className="mt-0.5 text-sm font-medium text-gray-600">{note}</p> : null}
      </div>
      <p className="shrink-0 text-right">
        <span className="font-display text-2xl font-extrabold tabular-nums text-ink">
          {priceGbp !== null ? priceFor(priceGbp, currency, rates) : "·"}
        </span>
        <span className="ml-1 text-sm font-medium text-gray-600">/mo</span>
      </p>
    </div>
  );
}

function CardShell({
  name,
  sub,
  featured,
  bg,
  children,
}: {
  name: string;
  sub: string;
  featured?: boolean;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        `flex flex-col border-[3px] border-ink ${bg} p-7 sm:p-8 ` +
        (featured ? "shadow-brut-xl" : "shadow-brut")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">
          {name}
        </h4>
        {featured ? <Badge tone="yellow">Most popular</Badge> : null}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-700">{sub}</p>
      <div className="mt-7">{children}</div>
      <div className="mt-auto pt-7">
        <DiscoveryCta size="md" className="w-full" />
      </div>
    </div>
  );
}

function ChatCard({ tier, currency, rates, bg }: { tier: ChatTier; currency: Currency; rates: Rates; bg: string }) {
  if (tier.contactOnly) {
    return (
      <CardShell name={tier.name} sub={tier.fleet} bg={bg}>
        <p className="font-display text-2xl font-extrabold uppercase text-ink">Contact us</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          Larger fleets and multi-channel builds are quoted around your fleet, channels and dispatch setup.
        </p>
      </CardShell>
    );
  }
  return (
    <CardShell name={tier.name} sub={tier.fleet} featured={tier.featured} bg={bg}>
      <PriceRow label="Single channel" priceGbp={tier.singleGbp} currency={currency} rates={rates} />
      <PriceRow
        label="Channel bundle"
        priceGbp={tier.bundleGbp}
        currency={currency}
        rates={rates}
        note={`Max ${tier.bundleMaxChannels} channels`}
      />
    </CardShell>
  );
}

function VoiceCard({ tier, currency, rates, bg }: { tier: VoiceTier; currency: Currency; rates: Rates; bg: string }) {
  return (
    <CardShell
      name={tier.name}
      sub={`${tier.callsPerMonth.toLocaleString("en-US")} calls / mo · ${tier.config}`}
      featured={tier.featured}
      bg={bg}
    >
      <PriceRow label="Monthly plan" priceGbp={tier.priceGbp} currency={currency} rates={rates} />
    </CardShell>
  );
}

function BundleCard({ tier, currency, rates, bg }: { tier: BundleTier; currency: Currency; rates: Rates; bg: string }) {
  return (
    <CardShell name={tier.name} sub="Chat + AI Voice, one plan" featured={tier.featured} bg={bg}>
      <PriceRow label={tier.single.label} priceGbp={tier.single.priceGbp} currency={currency} rates={rates} />
      <PriceRow label={tier.bundle.label} priceGbp={tier.bundle.priceGbp} currency={currency} rates={rates} />
    </CardShell>
  );
}

function SetupTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-[3px] border-ink bg-paper px-6 py-5 shadow-brut-sm">
      <p className="text-sm font-bold uppercase tracking-[0.08em] text-gray-600">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/**
 * Stateful pricing block. Owns the selected currency, renders the toggle once
 * at the top, then three product sections (Chat, AI Voice Booking, Double
 * Decker), then setup-fee tiles and the pay-as-you-go voice credit line.
 * `rates` come from the server page (live FX, with fallback).
 */
export function PricingSections({ rates }: { rates: Rates }) {
  const [currency, setCurrency] = useState<Currency>("GBP");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-bold uppercase tracking-[0.08em] text-gray-600">
          All plans /month · excl. VAT &amp; taxes · prices in {currency}
        </p>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {/* 1. CHAT */}
      <div className="mt-10">
        <SectionHeading
          kicker="Chat"
          title="Chat"
          blurb="One bespoke booking bot across WhatsApp, Messenger, Instagram, Telegram and a web chat widget. Priced by fleet size."
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {CHAT_TIERS.map((tier, i) => (
            <ChatCard key={tier.key} tier={tier} currency={currency} rates={rates} bg={CARD_BG[i]} />
          ))}
        </div>
        <div className="mt-5">
          <SetupTile label="One-time Chat setup fee" value={priceFor(CHAT_SETUP_FEE_GBP, currency, rates)} />
        </div>
      </div>

      {/* 2. AI VOICE BOOKING */}
      <div className="mt-16">
        <SectionHeading
          kicker="Voice"
          title="AI Voice Booking"
          blurb="An always-on voice agent that answers the phone and books the job. Priced by monthly call allowance — credits are fresh each month and do not carry over."
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {VOICE_TIERS.map((tier, i) => (
            <VoiceCard key={tier.key} tier={tier} currency={currency} rates={rates} bg={CARD_BG[i]} />
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <SetupTile label="Setup · 1 agent" value={priceFor(VOICE_SETUP_GBP.oneAgent, currency, rates)} />
          <SetupTile label="Setup · 2 agents" value={priceFor(VOICE_SETUP_GBP.twoAgents, currency, rates)} />
          <SetupTile label="Add a 2nd agent later" value={priceFor(VOICE_SETUP_GBP.secondAgentAddOn, currency, rates)} />
        </div>
      </div>

      {/* 3. DOUBLE DECKER */}
      <div className="mt-16">
        <SectionHeading
          kicker="Bundle"
          title="Double Decker"
          blurb="Chat and AI Voice together on one plan, at a lower combined price than buying each on its own."
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {BUNDLE_TIERS.map((tier, i) => (
            <BundleCard key={tier.key} tier={tier} currency={currency} rates={rates} bg={CARD_BG[i]} />
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SetupTile label="Setup · 1 chat + 1 voice agent" value={priceFor(BUNDLE_SETUP_GBP.oneVoiceAgent, currency, rates)} />
          <SetupTile label="Setup · 1 chat + 2 voice agents" value={priceFor(BUNDLE_SETUP_GBP.twoVoiceAgents, currency, rates)} />
        </div>
      </div>

      {/* EXTRA VOICE CREDIT */}
      <div className="mt-12 border-[3px] border-ink bg-brut-yellow px-6 py-6 shadow-brut sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">
            Extra voice credit
          </p>
          <p className="mt-1 text-sm font-medium text-ink/80">
            Top up any time. Charged per call, not per minute. 1 credit = one call.
          </p>
        </div>
        <p className="mt-3 shrink-0 sm:mt-0">
          <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
            {priceFor(EXTRA_CALL_PRICE_GBP, currency, rates, 2)}
          </span>
          <span className="ml-1 text-sm font-bold uppercase tracking-[0.06em] text-ink/70">/ call</span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete the old component**

```bash
git rm src/components/marketing/pricing-cards.tsx
```

> If anything other than the pricing page imports `PricingCards`, the build in Task 6 will surface it. Only the pricing page should reference it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/pricing-sections.test.tsx`
Expected: PASS (all five assertions).

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/pricing-sections.tsx tests/pricing-sections.test.tsx
git commit -m "feat(pricing): three-section Chat / Voice / Double Decker pricing UI"
```

---

### Task 4: Wire the pricing page to live FX

**Files:**
- Modify: `src/app/(marketing)/pricing/page.tsx`

> The page becomes an `async` server component: it fetches rates once and passes them to both `PricingSections` and `PricingRoi`. Update the hero/section copy to reflect two products instead of "one fixed price".

- [ ] **Step 1: Replace the import and render**

In `src/app/(marketing)/pricing/page.tsx`:

1. Remove the import line `import { PricingCards } from "@/components/marketing/pricing-cards";` and add:

```tsx
import { PricingSections } from "@/components/marketing/pricing-sections";
import { getFxRates } from "@/lib/marketing/fx";
```

2. Change the component signature from `export default function PricingPage() {` to:

```tsx
export default async function PricingPage() {
  const rates = await getFxRates();
```

3. Replace the cards `Section` block. Find:

```tsx
      {/* Cards + currency toggle + setup fee + contract */}
      <Section className="py-10 sm:py-14">
        <Container>
          <PricingCards />
        </Container>
      </Section>
```

Replace with:

```tsx
      {/* Three product sections + currency toggle + setup fees + credit */}
      <Section className="py-10 sm:py-14">
        <Container>
          <PricingSections rates={rates} />
        </Container>
      </Section>
```

4. Update the hero copy. Find the `<h1>` "One fixed price." block and its paragraph, and replace the paragraph text:

```tsx
          <p className="mt-6 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Two products, one bill. A multi-channel Chat bot and an AI Voice
            agent — buy either on its own, or bundle both as a Double Decker.
            You pay BookMyCab one monthly price and one setup fee; your channel
            and dispatch providers you pay directly, at their cost.
          </p>
```

- [ ] **Step 2: Pass rates to the ROI calculator (forward reference to Task 5)**

In the ROI `Section`, change `<PricingRoi />` to `<PricingRoi rates={rates} />`. (The `rates` prop is added to `PricingRoi` in Task 5; until then `tsc` will flag it — that is expected and resolved in Task 5.)

- [ ] **Step 3: Verify the page typechecks against Task 5**

Run: `npx tsc --noEmit`
Expected: One error remains on `<PricingRoi rates={rates} />` until Task 5 lands. All other pricing errors gone. (If you prefer a clean checkpoint, do Task 5 before committing.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/pricing/page.tsx"
git commit -m "feat(pricing): fetch live FX server-side and render product sections"
```

---

### Task 5: Realign the ROI calculator to the new Chat tiers + live FX

**Files:**
- Modify: `src/components/marketing/pricing-roi.tsx`

> The ROI calculator currently hand-codes tier prices (£500/£800) and per-currency staff rates, and owns its own `CurrencyToggle`. Update it to: (a) accept `rates` and convert from GBP, (b) use the new Chat tier numbers (Ignition £499 ≤50, In Motion £999 51–100, Full Throttle floor = In Motion), keeping its own currency toggle for a self-contained widget.

- [ ] **Step 1: Read the current file**

Read `src/components/marketing/pricing-roi.tsx` in full so you preserve its layout/markup. Only the data/conversion wiring changes.

- [ ] **Step 2: Add the `rates` prop and convert GBP figures**

Make these precise edits:

1. Update imports — replace the pricing import block with:

```tsx
import {
  EXTRA_CALL_PRICE_GBP,
  convert,
  formatPrice,
  type Currency,
} from "@/lib/marketing/pricing";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";
```

2. Change the staff-rate constant to a single GBP base rate (converted at display):

```tsx
// GBP base; converted to the selected currency via the live FX rate.
const STAFF_RATE_GBP = 12;
```

3. Replace `tierFor` with new-tier GBP figures:

```tsx
type Tier = { name: string; monthlyGbp: number };

function tierFor(drivers: number): Tier {
  if (drivers <= 50) return { name: "Ignition", monthlyGbp: 499 };
  if (drivers <= 100) return { name: "In Motion", monthlyGbp: 999 };
  // Full Throttle is quoted individually; use In Motion as a conservative floor.
  return { name: "Full Throttle", monthlyGbp: 999 };
}
```

4. Update the component signature to accept rates:

```tsx
export function PricingRoi({ rates }: { rates: Record<Currency, number> }) {
```

5. In the `compute(...)` function (or inline where it runs), convert GBP figures to the selected currency. Replace the staff-cost and plan-cost lines so they read:

```tsx
  const staffRate = convert(STAFF_RATE_GBP, currency, rates);
  const staffCostSaved = hoursSaved * staffRate;
  // ...
  const tier = tierFor(drivers);
  const planMonthly = convert(tier.monthlyGbp, currency, rates);
```

> Preserve every other line of `compute` and the JSX. The function previously indexed `STAFF_RATE[currency]` and `tier.monthly[currency]`; those lookups no longer exist, so the two replacements above are the only logic changes. If `compute` is a top-level function that does not see `currency`/`rates`, pass them in as arguments and update the call site accordingly.

6. Anywhere a raw GBP add-on figure is printed (e.g. an extra-credit reference, if present), format via `formatPrice(currency, convert(EXTRA_CALL_PRICE_GBP, currency, rates), { decimals: 2 })`. If the ROI widget does not mention credit, skip this.

- [ ] **Step 3: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS — no errors (this also clears the Task 4 forward-reference error).

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`
Expected: PASS — pricing, fx, pricing-sections, and all existing marketing tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/pricing-roi.tsx
git commit -m "feat(pricing): ROI calculator uses new Chat tiers and live FX conversion"
```

---

### Task 6: Copy, metadata, and full verification

**Files:**
- Modify: `src/app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Update the page metadata description**

In `src/app/(marketing)/pricing/page.tsx`, replace the `metadata.description` with:

```tsx
  description:
    "Transparent pricing for BookMyCab. A multi-channel Chat bot and an AI Voice agent — buy either, or bundle both as a Double Decker. Fixed monthly plans by fleet size and call volume, one-time setup, and pay-as-you-go voice credit at £0.90 per call.",
```

- [ ] **Step 2: Check the add-ons / closing copy still makes sense**

Read the remainder of the page below `PricingSections`. The existing add-ons section (Support Bot, Driver Solution, Custom automations) and any "Support Bot, Driver Solution… quoted on demand" line still apply — leave them. Remove any leftover sentence that claims a single "one monthly price" model if it now reads as contradicting two products. Make only the minimal copy edit needed for consistency.

- [ ] **Step 3: Grep for stale references**

Run: `grep -rn "PricingCards\|CONTRACT_MONTHS\|SETUP_FEE\b\|PRICING\." src tests`
Expected: No results in `src/` or `tests/` (all migrated). If any remain, fix them — they are stale imports from the old model.

- [ ] **Step 4: Full verification gate**

Run each and confirm green:

```bash
npx tsc --noEmit
npm test
npm run lint
npm run build
```

Expected: typecheck clean, all tests pass, lint clean, production build succeeds.

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000/pricing`. Confirm:
- Three sections render: Chat, AI Voice Booking, Double Decker.
- Toggling GBP → EUR → USD updates every price (cards, setup tiles, credit) and the "prices in X" label.
- The extra voice credit shows two decimals (e.g. `£0.90`).
- Cards keep the Neo-Brutalism look (thick ink borders, brut color fills, shadow-brut).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/pricing/page.tsx"
git commit -m "feat(pricing): updated pricing copy + metadata for two-product model"
```

---

## Self-Review

**Spec coverage (pricing section of the spec):**
- Chat Ignition/In Motion/Full Throttle + setup £1000 → Task 1 data, Task 3 UI ✓
- Voice Ignition/In Motion/Full Throttle + tiered setup (£1000/£1500/£500) → Task 1, Task 3 ✓
- Double Decker single+bundle rows per tier + setup (£1500/£2000) → Task 1, Task 3 ✓
- Extra voice credit £0.90/call → Task 1 constant, Task 3 yellow banner with 2-decimal display ✓
- GBP/EUR/USD toggle, GBP default, convert at market price → Task 2 live FX + Task 3 toggle ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"write tests for the above" — every code step has complete code. ✓

**Type consistency:** `priceFor`, `convert`, `formatPrice(currency, amount, { decimals })`, `getFxRates`, `parseFxResponse`, `FX_FALLBACK`, `PricingSections({ rates })`, `ChatTier/VoiceTier/BundleTier`, `*_GBP` constants — names are identical across data, FX, component, page, ROI, and tests. ✓

> **Note:** The app/dashboard portion of the original spec (call-credit metering, billing, coupons, multi-agent analytics, schema) is intentionally NOT in this plan — it is covered by the companion program plan `2026-06-10-app-revamp-program.md`. This plan ships a complete, standalone pricing page.
