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
