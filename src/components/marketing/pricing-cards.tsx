"use client";

import { useState } from "react";
import {
  PRICING,
  SETUP_FEE,
  CONTRACT_MONTHS,
  formatPrice,
  type Currency,
  type PricingTierAB,
} from "@/lib/marketing/pricing";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { Badge } from "@/components/marketing/ui/badge";

type TierMeta = {
  key: "A" | "B" | "C";
  name: string;
  fleet: string;
  /** Visually highlighted with the accent. */
  featured?: boolean;
};

// §6.1 tier framing.
const TIERS: TierMeta[] = [
  { key: "A", name: "Option A", fleet: "Up to 25 drivers / fleet" },
  { key: "B", name: "Option B", fleet: "26–100 drivers / fleet", featured: true },
  { key: "C", name: "Option C", fleet: "101+ drivers, or 4+ channels / custom" },
];

/** One priced line (single channel or bundle) within an A/B card. */
function PriceLine({
  label,
  amount,
  currency,
  note,
}: {
  label: string;
  amount: number | null;
  currency: Currency;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-gray-200 py-4 first:border-t-0 first:pt-0">
      <div>
        <p className="font-display text-base font-semibold text-ink">{label}</p>
        {note ? <p className="mt-0.5 text-sm text-gray-500">{note}</p> : null}
      </div>
      <p className="shrink-0 text-right">
        <span className="font-display text-2xl font-semibold text-ink">
          {amount !== null ? formatPrice(currency, amount) : "—"}
        </span>
        <span className="ml-1 text-sm text-gray-500">/mo</span>
      </p>
    </div>
  );
}

function AbCard({
  meta,
  tier,
  currency,
}: {
  meta: TierMeta;
  tier: PricingTierAB;
  currency: Currency;
}) {
  const featured = meta.featured ?? false;
  return (
    <div
      className={
        "flex flex-col rounded-3xl border p-7 sm:p-8 " +
        (featured
          ? "border-ink bg-paper shadow-[0_1px_0_0_var(--color-accent),0_0_0_2px_var(--color-ink)]"
          : "border-gray-200 bg-paper")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-semibold text-ink">
          {meta.name}
        </h3>
        {featured ? (
          <Badge className="border-ink bg-accent text-accent-ink">
            Most popular
          </Badge>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
        {meta.fleet}
      </p>

      <div className="mt-7">
        <PriceLine
          label="Single channel"
          amount={tier.single[currency]}
          currency={currency}
        />
        <PriceLine
          label="Channel bundle"
          amount={tier.bundle[currency]}
          currency={currency}
          note={`Min ${tier.bundleMinChannels} channels`}
        />
      </div>

      <div className="mt-auto pt-7">
        <DiscoveryCta size="md" className="w-full" />
      </div>
    </div>
  );
}

function ContactCard({ meta }: { meta: TierMeta }) {
  return (
    <div className="flex flex-col rounded-3xl border border-gray-200 bg-gray-50 p-7 sm:p-8">
      <h3 className="font-display text-xl font-semibold text-ink">
        {meta.name}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
        {meta.fleet}
      </p>

      <div className="mt-7">
        <p className="font-display text-2xl font-semibold text-ink">
          Contact Us
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Larger fleets and bespoke multi-automation builds are quoted around
          your fleet, channels and dispatch setup.
        </p>
      </div>

      <div className="mt-auto pt-7">
        <DiscoveryCta size="md" className="w-full" />
      </div>
    </div>
  );
}

/**
 * Stateful pricing block. Owns the selected currency and renders the toggle
 * plus the three tier cards. All displayed prices — card prices and the setup
 * fee — re-render from the pricing module when the currency changes.
 */
export function PricingCards() {
  const [currency, setCurrency] = useState<Currency>("GBP");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
          All prices /month · excl. VAT &amp; taxes
        </p>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <AbCard meta={TIERS[0]} tier={PRICING.A} currency={currency} />
        <AbCard meta={TIERS[1]} tier={PRICING.B} currency={currency} />
        <ContactCard meta={TIERS[2]} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-paper px-6 py-5">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            One-time setup fee
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {formatPrice(currency, SETUP_FEE[currency])}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-paper px-6 py-5">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            Minimum contract
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {CONTRACT_MONTHS} months
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-gray-500">
        Support Bot, Driver Solution, and custom automations are quoted on
        demand.
      </p>
    </div>
  );
}
