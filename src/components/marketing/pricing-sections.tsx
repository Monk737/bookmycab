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
} from "@/lib/marketing/pricing";
import Image from "next/image";
import { VoiceGlyph } from "@/components/marketing/product-marks";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { Badge } from "@/components/marketing/ui/badge";

type Rates = Record<Currency, number>;

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
      {currency !== "GBP" && (
        <p className="mt-2 text-xs font-medium text-gray-500">
          {currency} figures are indicative, converted from GBP at today&apos;s rate. Billing is in GBP (£).
        </p>
      )}

      {/* 1. CHAT — one rate-card panel: WhatsApp identity header, three tier
          columns on shared ink hairlines, setup + CTA in the footer band. */}
      <div className="mt-10">
        <Badge>Chat</Badge>
        <div className="mt-4 grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl">
          <div className="flex flex-wrap items-center gap-4 bg-paper px-6 py-5 sm:px-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink bg-paper">
              <Image src="/social/whatsapp.png" alt="" width={48} height={48} className="h-9 w-9 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-3xl">
                WhatsApp Chat + Voice Note
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">
                One WhatsApp chatbot that books by text or voice note and writes the job straight to dispatch. Priced by fleet size.
              </p>
            </div>
          </div>

          <div className="grid gap-[3px] bg-ink sm:grid-cols-3">
            {CHAT_TIERS.map((tier) => (
              <div key={tier.key} className={`flex flex-col p-6 sm:p-7 ${tier.featured ? "bg-brut-cyan" : "bg-paper"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">{tier.name}</h4>
                  {tier.featured ? <Badge tone="yellow">Most popular</Badge> : null}
                </div>
                <p className="mt-1 text-sm font-medium text-gray-700">{tier.fleet}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
                    {priceFor(tier.priceGbp, currency, rates)}
                  </span>
                  <span className="text-sm font-medium text-gray-600">/mo</span>
                </p>
                {tier.note ? <p className="mt-2 text-sm text-gray-700">{tier.note}</p> : null}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 bg-paper px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm font-medium text-gray-700">
              One-time setup{" "}
              <span className="ml-1 font-display text-xl font-extrabold tabular-nums text-ink">
                {priceFor(CHAT_SETUP_FEE_GBP, currency, rates)}
              </span>
            </p>
            <DiscoveryCta size="md" />
          </div>
        </div>
      </div>

      {/* 2. AI VOICE BOOKING — ink-headed panel mirroring the call UI; the
          monthly call allowance is the product, so it leads each column. */}
      <div className="mt-14">
        <Badge>Voice</Badge>
        <div className="mt-4 grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl">
          <div className="flex flex-wrap items-center gap-4 bg-ink px-6 py-5 sm:px-8">
            <VoiceGlyph className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-paper sm:text-3xl">
                AI Voice Booking
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                An always-on agent that answers the phone and books the job. Priced by monthly call allowance; calls reset each month and do not carry over.
              </p>
            </div>
          </div>

          <div className="grid gap-[3px] bg-ink sm:grid-cols-3">
            {VOICE_TIERS.map((tier) => (
              <div key={tier.key} className={`flex flex-col p-6 sm:p-7 ${tier.featured ? "bg-brut-yellow" : "bg-paper"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">{tier.name}</h4>
                  {tier.featured ? <Badge tone="paper">Most popular</Badge> : null}
                </div>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
                    {tier.callsPerMonth.toLocaleString("en-US")}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink/70">calls / mo</span>
                </p>
                <p className="mt-1 text-sm font-medium text-ink/80">{tier.config}</p>
                <p className="mt-5 flex items-baseline gap-1 border-t-2 border-ink/15 pt-4">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
                    {priceFor(tier.priceGbp, currency, rates)}
                  </span>
                  <span className="text-sm font-medium text-ink/70">/mo</span>
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 bg-paper px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <dl className="flex flex-wrap gap-x-7 gap-y-2">
              {[
                ["Setup · 1 agent", VOICE_SETUP_GBP.oneAgent],
                ["Setup · 2 agents", VOICE_SETUP_GBP.twoAgents],
                ["Add a 2nd agent later", VOICE_SETUP_GBP.secondAgentAddOn],
              ].map(([label, gbp]) => (
                <div key={label as string}>
                  <dt className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600">{label}</dt>
                  <dd className="mt-0.5 font-display text-xl font-extrabold tabular-nums text-ink">
                    {priceFor(gbp as number, currency, rates)}
                  </dd>
                </div>
              ))}
            </dl>
            <DiscoveryCta size="md" />
          </div>
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
