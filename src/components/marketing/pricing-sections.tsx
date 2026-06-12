"use client";

import { useState } from "react";
import {
  CHAT_TIERS,
  CHAT_SETUP_FEE_GBP,
  VOICE_TIERS,
  VOICE_SETUP_GBP,
  BUNDLE_SETUP_GBP,
  BUNDLE_CHAT_DISCOUNT_GBP,
  bundleChatPriceGbp,
  bundleTotalGbp,
  EXTRA_CALL_PRICE_GBP,
  priceFor,
  type Currency,
  type TierKey,
  type ChatTier,
  type VoiceTier,
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
      <div className="mt-7 flex flex-1 flex-col">{children}</div>
      <div className="mt-auto pt-7">
        <DiscoveryCta size="md" className="w-full" />
      </div>
    </div>
  );
}

/** Big price + /mo unit. */
function PriceTag({ priceGbp, currency, rates }: { priceGbp: number; currency: Currency; rates: Rates }) {
  return (
    <p className="flex items-baseline gap-1">
      <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
        {priceFor(priceGbp, currency, rates)}
      </span>
      <span className="text-sm font-medium text-gray-600">/mo</span>
    </p>
  );
}

function ChatCard({ tier, currency, rates, bg }: { tier: ChatTier; currency: Currency; rates: Rates; bg: string }) {
  return (
    <CardShell name={tier.name} sub={tier.fleet} featured={tier.featured} bg={bg}>
      <PriceTag priceGbp={tier.priceGbp} currency={currency} rates={rates} />
      <p className="mt-3 text-sm font-medium text-ink">WhatsApp Chat + Voice Note</p>
      {tier.note ? <p className="mt-1 text-sm text-gray-600">{tier.note}</p> : null}
    </CardShell>
  );
}

function VoiceCard({ tier, currency, rates, bg }: { tier: VoiceTier; currency: Currency; rates: Rates; bg: string }) {
  return (
    <CardShell
      name={tier.name}
      sub={`${tier.callsPerMonth.toLocaleString("en-US")} calls / mo`}
      featured={tier.featured}
      bg={bg}
    >
      <PriceTag priceGbp={tier.priceGbp} currency={currency} rates={rates} />
      <p className="mt-3 text-sm font-medium text-ink">{tier.config}</p>
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

/** Pill-style segmented selector for a tier. */
function TierPicker({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: TierKey;
  onChange: (t: TierKey) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold uppercase tracking-[0.08em] text-ink/70">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {VOICE_TIERS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={value === t.key}
            onClick={() => onChange(t.key)}
            className={`brut-focus border-[3px] border-ink px-3.5 py-2 text-sm font-bold uppercase tracking-tight transition-colors ${
              value === t.key ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-ink/5"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Interactive Double Decker (Mix & Match): pick any AI Voice tier (full price)
 * plus any Chat tier (discounted), and the combined monthly total updates live,
 * showing the chat strike-through and the amount saved.
 */
function MixAndMatch({ currency, rates }: { currency: Currency; rates: Rates }) {
  const [voiceTier, setVoiceTier] = useState<TierKey>("in_motion");
  const [chatTier, setChatTier] = useState<TierKey>("in_motion");

  const voice = VOICE_TIERS.find((t) => t.key === voiceTier)!;
  const chat = CHAT_TIERS.find((t) => t.key === chatTier)!;
  const discount = BUNDLE_CHAT_DISCOUNT_GBP[chatTier];
  const total = bundleTotalGbp(voiceTier, chatTier);

  return (
    <div className="grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl lg:grid-cols-[1fr_minmax(0,22rem)]">
      {/* Pickers */}
      <div className="bg-brut-yellow p-7 sm:p-9">
        <div className="flex flex-col gap-6">
          <TierPicker legend="AI Voice Booking (full price)" value={voiceTier} onChange={setVoiceTier} />
          <TierPicker legend="WhatsApp Chat + Voice Note (discounted)" value={chatTier} onChange={setChatTier} />
        </div>
        <dl className="mt-7 space-y-2.5 border-t-2 border-ink pt-5 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink/70">AI Voice · {voice.name}</dt>
            <dd className="font-mono font-bold tabular-nums text-ink">
              {priceFor(voice.priceGbp, currency, rates)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink/70">Chat · {chat.name}</dt>
            <dd className="text-right font-mono tabular-nums text-ink">
              <span className="mr-2 text-ink/45 line-through">{priceFor(chat.priceGbp, currency, rates)}</span>
              <span className="font-bold">{priceFor(bundleChatPriceGbp(chatTier), currency, rates)}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Total */}
      <div className="flex flex-col justify-between bg-paper p-7 sm:p-9">
        <div>
          <span className="inline-flex items-center border-2 border-ink bg-brut-lime px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink">
            Save {priceFor(discount, currency, rates)} / mo
          </span>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="font-display text-5xl font-extrabold tabular-nums text-ink">
              {priceFor(total, currency, rates)}
            </span>
            <span className="text-sm font-medium text-gray-600">/mo</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {voice.name} voice agent and {chat.name} chat on one plan, billed monthly.
          </p>
        </div>
        <div className="mt-7">
          <DiscoveryCta size="md" className="w-full" label="Build my bundle" />
        </div>
      </div>
    </div>
  );
}

/**
 * Stateful pricing block. Owns the selected currency, renders the toggle once at
 * the top, then three product sections (Chat, AI Voice Booking, Double Decker
 * Mix & Match), setup-fee tiles, and the pay-as-you-go voice credit line.
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
          title="WhatsApp Chat + Voice Note"
          blurb="One WhatsApp chatbot that books by text or voice note, writes the job straight to dispatch, and is priced by your fleet size."
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {CHAT_TIERS.map((tier, i) => (
            <ChatCard key={tier.key} tier={tier} currency={currency} rates={rates} bg={CARD_BG[i % CARD_BG.length]} />
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
          blurb="An always-on voice agent that answers the phone and books the job. Priced by monthly call allowance; calls reset each month and do not carry over."
        />
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {VOICE_TIERS.map((tier, i) => (
            <VoiceCard key={tier.key} tier={tier} currency={currency} rates={rates} bg={CARD_BG[i % CARD_BG.length]} />
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <SetupTile label="Setup · 1 agent" value={priceFor(VOICE_SETUP_GBP.oneAgent, currency, rates)} />
          <SetupTile label="Setup · 2 agents" value={priceFor(VOICE_SETUP_GBP.twoAgents, currency, rates)} />
          <SetupTile label="Add a 2nd agent later" value={priceFor(VOICE_SETUP_GBP.secondAgentAddOn, currency, rates)} />
        </div>
      </div>

      {/* 3. DOUBLE DECKER — Mix & Match */}
      <div className="mt-16">
        <SectionHeading
          kicker="Bundle"
          title="Double Decker · Mix & Match"
          blurb="Run both products together. Keep any AI Voice tier at its full price and take any Chat tier at a discount. Build the combination that fits your firm."
        />
        <div className="mt-6">
          <MixAndMatch currency={currency} rates={rates} />
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
