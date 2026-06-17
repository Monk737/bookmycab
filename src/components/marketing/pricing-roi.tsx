"use client";

import { useId, useState } from "react";
import {
  convert,
  formatPrice,
  CHAT_SUITE,
  type Currency,
} from "@/lib/marketing/pricing";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";

/* ---------------------------------------------------------------------------
   Industry-average assumptions. Two honest levers drive the model:

   1. Fleet size  → WhatsApp Chat value. Every typed and voice-note booking the
      bot handles is dispatcher time saved off the desk.
   2. Missed calls / day → AI Voice value. The calls that ring out today (engaged
      tone, after-hours, nobody free) get answered and booked instead of lost to
      the firm down the road. The agent picks up everything, so the only honest
      question is "how many calls slip through now?", not "how often does it work?".
   --------------------------------------------------------------------------- */
const BOOKINGS_PER_DRIVER_MONTH = 240;
const DISPATCH_MIN_SAVED_PER_BOOKING = 1.5;
// Of the calls that ring out today, the share the AI Voice agent answers and
// turns into a confirmed booking. It picks up every one; not every caller books.
const VOICE_BOOK_RATE = 0.7;
const DAYS_PER_MONTH = 30;
// GBP base; converted to the selected currency via the live FX rate.
const STAFF_RATE_GBP = 12;

type Tier = { name: string; monthlyGbp: number };

function planFor(): Tier {
  return { name: CHAT_SUITE.name, monthlyGbp: CHAT_SUITE.priceGbp };
}

function compute(
  drivers: number,
  avgFare: number,
  missedCallsPerDay: number,
  currency: Currency,
  rates: Record<Currency, number>,
) {
  // WhatsApp Chat side: dispatcher time the bot takes off the desk.
  const bookings = drivers * BOOKINGS_PER_DRIVER_MONTH;
  const hoursSaved = (bookings * DISPATCH_MIN_SAVED_PER_BOOKING) / 60;
  const staffRate = convert(STAFF_RATE_GBP, currency, rates);
  const staffCostSaved = hoursSaved * staffRate;

  // AI Voice side: missed calls answered and booked, times the fare.
  const voiceBookings = missedCallsPerDay * VOICE_BOOK_RATE * DAYS_PER_MONTH;
  const voiceRevenue = voiceBookings * avgFare;

  const tier = planFor();
  const planMonthly = convert(tier.monthlyGbp, currency, rates);
  const monthlyValue = staffCostSaved + voiceRevenue;
  const netMonthly = monthlyValue - planMonthly;
  const annualNet = netMonthly * 12;
  const setup = convert(CHAT_SUITE.setupGbp, currency, rates);
  const dailyNet = netMonthly / 30;
  const paybackDays = dailyNet > 0 ? Math.ceil(setup / dailyNet) : null;

  return {
    hoursSaved: Math.round(hoursSaved),
    staffCostSaved: Math.round(staffCostSaved),
    voiceBookings: Math.round(voiceBookings),
    voiceRevenue: Math.round(voiceRevenue),
    tierName: tier.name,
    planMonthly,
    netMonthly: Math.round(netMonthly),
    annualNet: Math.round(annualNet),
    setup,
    paybackDays,
  };
}

function FleetSlider({
  id,
  drivers,
  onChange,
  caption,
}: {
  id: string;
  drivers: number;
  onChange: (n: number) => void;
  caption: string;
}) {
  return (
    <div className="border-[3px] border-ink bg-paper p-5 shadow-brut-sm sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={id} className="text-sm font-bold uppercase tracking-[0.06em] text-gray-600">
          Fleet size
        </label>
        <span className="font-display text-3xl font-extrabold leading-none tabular-nums text-ink sm:text-4xl">
          {drivers}
          <span className="ml-2 align-baseline text-sm font-bold uppercase tracking-[0.04em] text-gray-500">
            drivers
          </span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={5}
        max={200}
        step={1}
        value={drivers}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 h-2.5 w-full cursor-pointer appearance-none border-2 border-ink bg-canvas focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{ accentColor: "#ffd400" }}
      />
      <div className="mt-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">
        <span>5 drivers</span>
        <span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 text-ink">{caption}</span>
        <span>200</span>
      </div>
    </div>
  );
}

function MiniSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  return (
    <div className="border-[3px] border-ink bg-paper p-5 shadow-brut-sm sm:p-6">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-bold uppercase tracking-[0.06em] text-gray-600">
          {label}
        </label>
        <span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-ink">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 h-2.5 w-full cursor-pointer appearance-none border-2 border-ink bg-canvas focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{ accentColor: "#ffd400" }}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-paper p-5 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-600">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{sub}</p>
    </div>
  );
}

function DarkMetric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-gray-900 p-5 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{label}</p>
      <p className={`mt-2 font-display text-3xl font-extrabold tabular-nums ${accent ? "text-brut-yellow" : "text-paper"}`}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs font-medium text-gray-500">{sub}</p> : null}
    </div>
  );
}

export function PricingRoi({ rates }: { rates: Record<Currency, number> }) {
  const fleetId = useId();
  const fareId = useId();
  const missedId = useId();

  const [currency, setCurrency] = useState<Currency>("GBP");
  const [drivers, setDrivers] = useState(20);
  const [avgFare, setAvgFare] = useState(18);
  const [missedCalls, setMissedCalls] = useState(6);

  const r = compute(drivers, avgFare, missedCalls, currency, rates);
  const money = (n: number) => formatPrice(currency, Math.max(0, n));

  return (
    <div className="border-[3px] border-ink bg-paper shadow-brut-xl">
      {/* Header strip */}
      <div className="flex flex-col gap-3 border-b-[3px] border-ink bg-ink px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-brut-yellow">
            ROI calculator
          </p>
          <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-tight text-paper">
            What WhatsApp Chat + AI Voice put back on the meter
          </p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="p-6 sm:p-8">
        {/* Inputs: fleet (the Chat lever) on the left; fare and missed calls
            (the AI Voice levers) stacked on the right. */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <FleetSlider
            id={fleetId}
            drivers={drivers}
            onChange={setDrivers}
            caption={`${r.tierName} · ${money(r.planMonthly)}/mo`}
          />
          <div className="grid gap-4">
            <MiniSlider
              id={fareId}
              label="Average fare"
              value={avgFare}
              min={5}
              max={80}
              step={1}
              onChange={setAvgFare}
              format={(n) => money(n)}
            />
            <MiniSlider
              id={missedId}
              label="Calls missed / day"
              value={missedCalls}
              min={0}
              max={60}
              step={1}
              onChange={setMissedCalls}
              format={(n) => `${n}`}
            />
          </div>
        </div>

        {/* Where the value comes from: two cards for the WhatsApp Chat side
            (dispatcher time) and two for the AI Voice side (missed calls booked). */}
        <div
          className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4"
          aria-live="polite"
          aria-atomic="true"
        >
          <Metric label="Dispatcher hours saved" value={`${r.hoursSaved} hrs`} sub="WhatsApp Chat, per month" />
          <Metric label="Staff cost saved" value={money(r.staffCostSaved)} sub="WhatsApp Chat, per month" />
          <Metric label="AI Voice bookings won" value={`${r.voiceBookings}`} sub="missed calls booked / mo" />
          <Metric label="AI Voice fare revenue" value={money(r.voiceRevenue)} sub="per month" />
        </div>

        {/* Bottom line, dark band */}
        <div className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          <DarkMetric label="Your plan" value={`${money(r.planMonthly)}`} sub={`${r.tierName}, /mo`} />
          <DarkMetric label="Net monthly benefit" value={money(r.netMonthly)} accent />
          <DarkMetric label="Annual net benefit" value={money(r.annualNet)} accent />
          <DarkMetric
            label="Setup paid back in"
            value={r.paybackDays === null ? "n/a" : `${r.paybackDays} day${r.paybackDays === 1 ? "" : "s"}`}
            sub={`on ${money(r.setup)} setup`}
          />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-gray-500">
          Based on industry averages: {BOOKINGS_PER_DRIVER_MONTH} bookings per
          driver a month, {DISPATCH_MIN_SAVED_PER_BOOKING} min of dispatcher time
          saved per booking, {money(convert(STAFF_RATE_GBP, currency, rates))}/hr staff rate, and the
          AI Voice agent booking {Math.round(VOICE_BOOK_RATE * 100)}% of the calls that ring out
          today across {DAYS_PER_MONTH} days. An estimate, not a quote.
        </p>
      </div>
    </div>
  );
}
