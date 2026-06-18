"use client";

import { useId, useState } from "react";
import {
  convert,
  formatPrice,
  CHAT_SUITE,
  VOICE_IGNITION,
  type Currency,
} from "@/lib/marketing/pricing";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";

/* ---------------------------------------------------------------------------
   Two separate calculators behind a tab. Both are driven by the one number an
   operator actually knows — how many booking calls / enquiries they handle a
   day — and use conservative industry averages so the figures stay believable.

   WhatsApp Booking Suite → the bot takes routine bookings off the desk (staff
   time saved) and captures the odd job that would otherwise slip away by phone.

   AI Voice Booking → the agent answers every call 24/7: it recovers the fares
   that ring out today and replaces the cost of a person sat on the phones.
   --------------------------------------------------------------------------- */

// Shared
const STAFF_RATE_GBP = 12; // a person answering the phones / desk, per hour
const DAYS_PER_MONTH = 30;

// WhatsApp Booking Suite levers
const WA_BOT_DEFLECTION = 0.45; // share of enquiries the bot fully handles itself
const WA_MIN_PER_BOOKING = 3; // staff minutes saved on each booking the bot takes
const WA_CAPTURE_SHARE = 0.05; // extra jobs won by message that a busy line loses

// AI Voice Booking levers
const VOICE_MISSED_SHARE = 0.22; // calls that ring out today (engaged, after-hours)
const VOICE_BOOK_RATE = 0.7; // answered calls that turn into a confirmed booking
const VOICE_HANDLE_MIN = 4; // staff minutes to answer and book one call by hand

type Tab = "chat" | "voice";

function computeChat(
  enquiriesPerDay: number,
  avgFare: number,
  currency: Currency,
  rates: Record<Currency, number>,
) {
  const monthlyEnquiries = enquiriesPerDay * DAYS_PER_MONTH;
  const automated = monthlyEnquiries * WA_BOT_DEFLECTION;
  const hoursSaved = (automated * WA_MIN_PER_BOOKING) / 60;
  const staffRate = convert(STAFF_RATE_GBP, currency, rates);
  const staffCostSaved = hoursSaved * staffRate;

  const capturedBookings = monthlyEnquiries * WA_CAPTURE_SHARE;
  const capturedRevenue = capturedBookings * avgFare;

  const planMonthly = convert(CHAT_SUITE.priceGbp, currency, rates);
  const monthlyValue = staffCostSaved + capturedRevenue;
  const netMonthly = monthlyValue - planMonthly;
  const setup = convert(CHAT_SUITE.setupGbp, currency, rates);
  const dailyNet = netMonthly / 30;
  const paybackDays = dailyNet > 0 ? Math.ceil(setup / dailyNet) : null;

  return {
    automated: Math.round(automated),
    staffCostSaved: Math.round(staffCostSaved),
    capturedBookings: Math.round(capturedBookings),
    capturedRevenue: Math.round(capturedRevenue),
    planName: CHAT_SUITE.name,
    planMonthly,
    netMonthly: Math.round(netMonthly),
    annualNet: Math.round(netMonthly * 12),
    setup,
    paybackDays,
  };
}

function computeVoice(
  callsPerDay: number,
  avgFare: number,
  currency: Currency,
  rates: Record<Currency, number>,
) {
  const monthlyCalls = callsPerDay * DAYS_PER_MONTH;
  const missed = monthlyCalls * VOICE_MISSED_SHARE;
  const recoveredBookings = missed * VOICE_BOOK_RATE;
  const recoveredRevenue = recoveredBookings * avgFare;

  const handleHours = (monthlyCalls * VOICE_HANDLE_MIN) / 60;
  const staffRate = convert(STAFF_RATE_GBP, currency, rates);
  const staffCostReplaced = handleHours * staffRate;

  const planMonthly = convert(VOICE_IGNITION.priceGbp, currency, rates);
  const monthlyValue = recoveredRevenue + staffCostReplaced;
  const netMonthly = monthlyValue - planMonthly;
  const setup = convert(VOICE_IGNITION.setupGbp, currency, rates);
  const dailyNet = netMonthly / 30;
  const paybackDays = dailyNet > 0 ? Math.ceil(setup / dailyNet) : null;

  return {
    monthlyCalls: Math.round(monthlyCalls),
    recoveredBookings: Math.round(recoveredBookings),
    recoveredRevenue: Math.round(recoveredRevenue),
    staffCostReplaced: Math.round(staffCostReplaced),
    planName: `AI Voice · ${VOICE_IGNITION.name}`,
    planMonthly,
    netMonthly: Math.round(netMonthly),
    annualNet: Math.round(netMonthly * 12),
    setup,
    paybackDays,
  };
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (n: number) => void;
  format?: (n: number) => string;
}) {
  return (
    <div className="border-[3px] border-ink bg-paper p-5 shadow-brut-sm sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <label htmlFor={id} className="text-sm font-bold uppercase tracking-[0.06em] text-gray-600">
          {label}
        </label>
        <span className="font-display text-3xl font-extrabold leading-none tabular-nums text-ink sm:text-4xl">
          {format ? format(value) : value}
          {unit ? (
            <span className="ml-2 align-baseline text-sm font-bold uppercase tracking-[0.04em] text-gray-500">
              {unit}
            </span>
          ) : null}
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

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
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

function TabButton({
  active,
  onClick,
  children,
  controls,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={
        "border-2 border-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-brut-yellow " +
        (active ? "bg-brut-yellow text-ink" : "bg-paper text-gray-600 hover:bg-canvas")
      }
    >
      {children}
    </button>
  );
}

export function PricingRoi({ rates }: { rates: Record<Currency, number> }) {
  const chatPanelId = useId();
  const voicePanelId = useId();
  const enquiriesId = useId();
  const chatFareId = useId();
  const callsId = useId();
  const voiceFareId = useId();

  const [tab, setTab] = useState<Tab>("chat");
  const [currency, setCurrency] = useState<Currency>("GBP");

  // WhatsApp tab inputs
  const [enquiries, setEnquiries] = useState(60);
  const [chatFare, setChatFare] = useState(18);

  // AI Voice tab inputs
  const [calls, setCalls] = useState(33);
  const [voiceFare, setVoiceFare] = useState(18);

  const chat = computeChat(enquiries, chatFare, currency, rates);
  const voice = computeVoice(calls, voiceFare, currency, rates);
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
            {tab === "chat"
              ? "What WhatsApp Booking takes off the desk"
              : "What AI Voice puts back on the meter"}
          </p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="ROI calculator" className="flex flex-wrap gap-2 border-b-[3px] border-ink bg-canvas px-6 py-4 sm:px-8">
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")} controls={chatPanelId}>
          WhatsApp Booking Suite
        </TabButton>
        <TabButton active={tab === "voice"} onClick={() => setTab("voice")} controls={voicePanelId}>
          AI Voice Booking
        </TabButton>
      </div>

      {/* WHATSAPP PANEL */}
      {tab === "chat" && (
        <div id={chatPanelId} role="tabpanel" className="p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider
              id={enquiriesId}
              label="Booking enquiries / day"
              value={enquiries}
              min={15}
              max={500}
              step={5}
              unit="a day"
              onChange={setEnquiries}
            />
            <Slider
              id={chatFareId}
              label="Average fare"
              value={chatFare}
              min={5}
              max={80}
              step={1}
              onChange={setChatFare}
              format={(n) => money(n)}
            />
          </div>

          <div
            className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4"
            aria-live="polite"
            aria-atomic="true"
          >
            <Metric label="Bookings automated" value={`${chat.automated}`} sub="handled by the bot / mo" />
            <Metric label="Staff cost saved" value={money(chat.staffCostSaved)} sub="desk time, per month" />
            <Metric label="Extra jobs captured" value={`${chat.capturedBookings}`} sub="won by message / mo" />
            <Metric label="Captured fare value" value={money(chat.capturedRevenue)} sub="per month" />
          </div>

          <div className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
            <DarkMetric label="Your plan" value={money(chat.planMonthly)} sub={`${chat.planName}, /mo`} />
            <DarkMetric label="Net monthly benefit" value={money(chat.netMonthly)} accent />
            <DarkMetric label="Annual net benefit" value={money(chat.annualNet)} accent />
            <DarkMetric
              label="Setup paid back in"
              value={chat.paybackDays === null ? "n/a" : `${chat.paybackDays} day${chat.paybackDays === 1 ? "" : "s"}`}
              sub={`on ${money(chat.setup)} setup`}
            />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-gray-500">
            Based on industry averages: the bot fully handles {Math.round(WA_BOT_DEFLECTION * 100)}% of
            booking enquiries on its own, saving {WA_MIN_PER_BOOKING} min of desk time each at{" "}
            {money(convert(STAFF_RATE_GBP, currency, rates))}/hr, and wins another{" "}
            {Math.round(WA_CAPTURE_SHARE * 100)}% as jobs a busy phone line would have lost. An estimate,
            not a quote.
          </p>
        </div>
      )}

      {/* AI VOICE PANEL */}
      {tab === "voice" && (
        <div id={voicePanelId} role="tabpanel" className="p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider
              id={callsId}
              label="Calls received / day"
              value={calls}
              min={20}
              max={120}
              step={1}
              unit="a day"
              onChange={setCalls}
            />
            <Slider
              id={voiceFareId}
              label="Average fare"
              value={voiceFare}
              min={5}
              max={80}
              step={1}
              onChange={setVoiceFare}
              format={(n) => money(n)}
            />
          </div>

          <div
            className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4"
            aria-live="polite"
            aria-atomic="true"
          >
            <Metric label="Calls answered" value={`${voice.monthlyCalls}`} sub="every one, 24/7 / mo" />
            <Metric label="Missed fares recovered" value={`${voice.recoveredBookings}`} sub="bookings won back / mo" />
            <Metric label="Recovered fare revenue" value={money(voice.recoveredRevenue)} sub="per month" />
            <Metric label="Phone-desk cost replaced" value={money(voice.staffCostReplaced)} sub="staff time, per month" />
          </div>

          <div className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
            <DarkMetric label="Your plan" value={money(voice.planMonthly)} sub={`${voice.planName}, /mo`} />
            <DarkMetric label="Net monthly benefit" value={money(voice.netMonthly)} accent />
            <DarkMetric label="Annual net benefit" value={money(voice.annualNet)} accent />
            <DarkMetric
              label="Setup paid back in"
              value={voice.paybackDays === null ? "n/a" : `${voice.paybackDays} day${voice.paybackDays === 1 ? "" : "s"}`}
              sub={`on ${money(voice.setup)} setup`}
            />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-gray-500">
            Based on industry averages: {Math.round(VOICE_MISSED_SHARE * 100)}% of calls ring out today
            (engaged, after-hours, nobody free), the agent answers them all and books{" "}
            {Math.round(VOICE_BOOK_RATE * 100)}% of those it recovers, and it replaces{" "}
            {VOICE_HANDLE_MIN} min of staff handling per call at{" "}
            {money(convert(STAFF_RATE_GBP, currency, rates))}/hr. Plan shown is Ignition; a Full Throttle
            pack scales past it. An estimate, not a quote.
          </p>
        </div>
      )}
    </div>
  );
}
