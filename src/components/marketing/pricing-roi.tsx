"use client";

import { useId, useState } from "react";
import {
  convert,
  formatPrice,
  CHAT_SETUP_FEE_GBP,
  type Currency,
} from "@/lib/marketing/pricing";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";

/* ---------------------------------------------------------------------------
   Industry-average assumptions. The model is driven by ONE honest lever, fleet
   size, because the automation answers everything; there is no "how often does
   it work" guess. Bigger fleet means more bookings, which means more dispatcher
   time saved and more out-of-hours fares captured.
   --------------------------------------------------------------------------- */
const BOOKINGS_PER_DRIVER_MONTH = 240;
const DISPATCH_MIN_SAVED_PER_BOOKING = 1.5;
const OUT_OF_HOURS_UPLIFT = 0.05; // 5% of bookings recovered from out-of-hours / missed
// GBP base; converted to the selected currency via the live FX rate.
const STAFF_RATE_GBP = 12;

type Tier = { name: string; monthlyGbp: number };

function tierFor(drivers: number): Tier {
  if (drivers <= 50) return { name: "Ignition", monthlyGbp: 599 };
  if (drivers <= 100) return { name: "In Motion", monthlyGbp: 999 };
  return { name: "Full Throttle", monthlyGbp: 1299 };
}

function compute(
  drivers: number,
  avgFare: number,
  currency: Currency,
  rates: Record<Currency, number>,
) {
  const bookings = drivers * BOOKINGS_PER_DRIVER_MONTH;
  const hoursSaved = (bookings * DISPATCH_MIN_SAVED_PER_BOOKING) / 60;
  const staffRate = convert(STAFF_RATE_GBP, currency, rates);
  const staffCostSaved = hoursSaved * staffRate;
  const extraBookings = bookings * OUT_OF_HOURS_UPLIFT;
  const revenueUplift = extraBookings * avgFare;

  const tier = tierFor(drivers);
  const planMonthly = convert(tier.monthlyGbp, currency, rates);
  const monthlyValue = staffCostSaved + revenueUplift;
  const netMonthly = monthlyValue - planMonthly;
  const annualNet = netMonthly * 12;
  const setup = convert(CHAT_SETUP_FEE_GBP, currency, rates);
  const dailyNet = netMonthly / 30;
  const paybackDays = dailyNet > 0 ? Math.ceil(setup / dailyNet) : null;

  return {
    hoursSaved: Math.round(hoursSaved),
    staffCostSaved: Math.round(staffCostSaved),
    extraBookings: Math.round(extraBookings),
    revenueUplift: Math.round(revenueUplift),
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

  const [currency, setCurrency] = useState<Currency>("GBP");
  const [drivers, setDrivers] = useState(20);
  const [avgFare, setAvgFare] = useState(18);

  const r = compute(drivers, avgFare, currency, rates);
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
        {/* Inputs */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <FleetSlider
            id={fleetId}
            drivers={drivers}
            onChange={setDrivers}
            caption={`${r.tierName} · ${money(r.planMonthly)}/mo`}
          />
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
        </div>

        {/* Operational value, four light cards on an ink grid */}
        <div
          className="mt-4 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4"
          aria-live="polite"
          aria-atomic="true"
        >
          <Metric label="Dispatcher hours saved" value={`${r.hoursSaved} hrs`} sub="per month" />
          <Metric label="Staff cost saved" value={money(r.staffCostSaved)} sub="per month" />
          <Metric label="Extra bookings captured" value={`${r.extraBookings}`} sub="out-of-hours & missed" />
          <Metric label="Revenue uplift" value={money(r.revenueUplift)} sub="per month" />
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
          saved per booking, {money(convert(STAFF_RATE_GBP, currency, rates))}/hr staff rate, a 5%
          out-of-hours uplift. An estimate, not a quote.
        </p>
      </div>
    </div>
  );
}
