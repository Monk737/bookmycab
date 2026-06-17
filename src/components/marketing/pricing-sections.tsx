"use client";

import { useState } from "react";
import {
  CHAT_SUITE,
  VOICE_IGNITION,
  EXTRA_CALL_PRICE_GBP,
  priceFor,
  type Currency,
} from "@/lib/marketing/pricing";
import Image from "next/image";
import { VoiceGlyph } from "@/components/marketing/product-marks";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { Badge } from "@/components/marketing/ui/badge";

type Rates = Record<Currency, number>;

/**
 * Stateful pricing block. Owns the selected currency, renders the toggle once,
 * then two product sections: the WhatsApp Booking Suite (one fixed price) and
 * AI Voice Booking (Ignition fixed tier + Full Throttle customised card).
 * Visual system unchanged — Neo-Brutalism rate-card panels.
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

      {/* 1. WHATSAPP BOOKING SUITE — one fixed price. */}
      <div className="mt-10">
        <Badge>Chat + Voice Note</Badge>
        <div className="mt-4 grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl">
          <div className="flex flex-wrap items-center gap-4 bg-paper px-6 py-5 sm:px-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink bg-paper">
              <Image src="/social/whatsapp.png" alt="" width={48} height={48} className="h-9 w-9 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-3xl">
                {CHAT_SUITE.name}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">
                Includes WhatsApp Chatbot + Voice Note. One simple price — books by text or voice note and writes the job straight to dispatch.
              </p>
            </div>
          </div>

          <div className="grid gap-[3px] bg-ink sm:grid-cols-2">
            <div className="flex flex-col bg-brut-cyan p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">One simple pricing</h4>
                <Badge tone="yellow">All-in</Badge>
              </div>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold tabular-nums text-ink">
                  {priceFor(CHAT_SUITE.priceGbp, currency, rates)}
                </span>
                <span className="text-sm font-medium text-gray-700">/mo</span>
              </p>
              <p className="mt-2 text-sm font-medium text-ink/80">WhatsApp Chatbot + Voice Note, one bot.</p>
            </div>
            <div className="flex flex-col bg-paper p-6 sm:p-7">
              <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">One-time setup</h4>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
                  {priceFor(CHAT_SUITE.setupGbp, currency, rates)}
                </span>
              </p>
              <p className="mt-2 text-sm text-gray-700">Bespoke build, wired to your dispatch.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-paper px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm font-medium text-gray-700">Live in days. Cancel any time, rolling monthly.</p>
            <DiscoveryCta size="md" />
          </div>
        </div>
      </div>

      {/* 2. AI VOICE BOOKING — Ignition (fixed) + Full Throttle (custom). */}
      <div className="mt-14">
        <Badge>AI Voice Booking</Badge>
        <div className="mt-4 grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl">
          <div className="flex flex-wrap items-center gap-4 bg-ink px-6 py-5 sm:px-8">
            <VoiceGlyph className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-paper sm:text-3xl">
                AI Voice Booking
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                An always-on agent that answers the phone and books the job. Start on Ignition, or scope a Full Throttle pack around your call volume.
              </p>
            </div>
          </div>

          <div className="grid gap-[3px] bg-ink sm:grid-cols-2">
            {/* A. IGNITION */}
            <div className="flex flex-col bg-brut-yellow p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">{VOICE_IGNITION.name}</h4>
                <Badge tone="paper">Most popular</Badge>
              </div>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
                  {VOICE_IGNITION.callsPerMonth.toLocaleString("en-US")}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink/70">calls / mo</span>
              </p>
              <p className="mt-5 flex items-baseline gap-1 border-t-2 border-ink/15 pt-4">
                <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
                  {priceFor(VOICE_IGNITION.priceGbp, currency, rates)}
                </span>
                <span className="text-sm font-medium text-ink/70">/mo</span>
              </p>
              <p className="mt-2 text-sm font-medium text-ink/80">
                One-time setup {priceFor(VOICE_IGNITION.setupGbp, currency, rates)}
              </p>
            </div>

            {/* B. FULL THROTTLE — customised pack */}
            <div className="flex flex-col bg-paper p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">Full Throttle</h4>
                <Badge>Custom</Badge>
              </div>
              <p className="mt-4 font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
                Customised pack
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                Your call volume, agents, validity and rates — scoped on a discovery call and built to fit.
              </p>
              <div className="mt-5 border-t-2 border-ink/15 pt-4">
                <DiscoveryCta size="md" className="w-full" label="Book a discovery call" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-paper px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm font-medium text-gray-700">Calls reset each month and don&apos;t carry over.</p>
            <DiscoveryCta size="md" />
          </div>
        </div>
      </div>

      {/* EXTRA VOICE CREDIT (base) */}
      <div className="mt-12 border-[3px] border-ink bg-brut-yellow px-6 py-6 shadow-brut sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">Extra voice credit</p>
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
