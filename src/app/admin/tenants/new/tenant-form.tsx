"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { createTenant } from "../actions";
import { type TenantFormState } from "../provisioning";
import { slugify } from "@/lib/admin/plan-bands";
import {
  resolveBasePlanPricing,
  type PlanType,
} from "@/lib/billing/pricing";
import { resolveCustomPlan } from "@/lib/billing/custom-plan";
import { formatPrice } from "@/lib/marketing/pricing";
import { COUNTRIES } from "@/lib/billing/country";

const DISPATCH_ADAPTERS = [
  { value: "autocab", label: "AutoCab" },
  { value: "icabbi", label: "iCabbi" },
  { value: "cordic", label: "Cordic" },
] as const;

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: "whatsapp_suite", label: "WhatsApp Booking Suite, £499/mo" },
  { value: "voice_ignition", label: "AI Voice, Ignition (1,000 calls, £1,999/mo)" },
  { value: "custom", label: "Custom (Full Throttle)" },
];

const initialState: TenantFormState = { fieldErrors: {}, formError: null };

const inputClass =
  "border-[3px] border-ink bg-paper px-3 py-2 text-sm text-ink placeholder:text-gray-400 outline-none transition-colors hover:border-gray-400 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink";

/** Labelled text/number/date input with inline aria-live error. */
function Field({
  id,
  name,
  label,
  error,
  hint,
  ...props
}: {
  id: string;
  name: string;
  label: string;
  error?: string | null;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-describedby={[error ? errorId : null, hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-ink focus-visible:border-brut-red-deep focus-visible:ring-ink" : ""}`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-brut-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}

/** Labelled select with inline aria-live error. */
function SelectField({
  id,
  name,
  label,
  error,
  value,
  onChange,
  children,
}: {
  id: string;
  name: string;
  label: string;
  error?: string | null;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-ink focus-visible:border-brut-red-deep focus-visible:ring-ink" : ""}`}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-brut-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Tenant provisioning form. The slug auto-derives from the org name until
 * edited. The plan_type selection drives a live, read-only GBP price summary.
 * For custom plans, a detailed configuration panel is shown inline.
 * Currency is always GBP.
 */
export function TenantForm() {
  const [state, formAction, pending] = useActionState(createTenant, initialState);

  const nameId = useId();
  const slugId = useId();
  const countryId = useId();
  const emailId = useId();
  const adapterId = useId();
  const companyId = useId();
  const modelId = useId();
  const couponId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [country, setCountry] = useState<string>("GB");
  const [dispatchAdapter, setDispatchAdapter] = useState<string>("autocab");

  const [planType, setPlanType] = useState<PlanType>("voice_ignition");
  const [customPlanName, setCustomPlanName] = useState("");
  // Custom-plan fields (controlled so the live summary updates).
  const [billingMode, setBillingMode] = useState<"recurring" | "one_time">("recurring");
  const [includesChat, setIncludesChat] = useState(false);
  const [includesVoice, setIncludesVoice] = useState(true);
  const [callAllowance, setCallAllowance] = useState("5000");
  const [includedAgents, setIncludedAgents] = useState("2");
  const [planPrice, setPlanPrice] = useState("4500");
  const [chatMonthly, setChatMonthly] = useState("499");
  const [setupFee, setSetupFee] = useState("1500");
  const [validityDays, setValidityDays] = useState("30");
  const [pricePerCall, setPricePerCall] = useState("0.90");
  const [extraCredit, setExtraCredit] = useState("0.75");

  const base = planType === "custom" ? null : resolveBasePlanPricing(planType);
  const custom =
    planType === "custom"
      ? resolveCustomPlan({
          planName: "preview", billingMode,
          includesChat, includesVoice,
          callAllowance: Number(callAllowance || 0),
          includedAgents: Number(includedAgents || 0),
          planPriceGbp: Number(planPrice || 0),
          chatMonthlyGbp: includesChat ? Number(chatMonthly || 0) : null,
          setupFeeGbp: Number(setupFee || 0),
          validityDays: Number(validityDays || 30),
          extraCreditPriceGbp: Number(extraCredit || 0),
          pricePerCallGbp: Number(pricePerCall || 0),
        })
      : null;
  const summaryChat = base ? base.chatGbp : custom?.chatGbp ?? null;
  const summaryVoice = base ? base.voiceGbp : custom?.voiceGbp ?? null;
  const summarySetup = base ? base.setupGbp : custom?.setupGbp ?? 0;
  const summaryFirst = base
    ? (summaryChat ?? 0) + (summaryVoice ?? 0) + base.setupGbp
    : (custom?.firstPeriodGbp ?? 0) + (custom?.setupGbp ?? 0);

  function handleName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <p
          role="alert"
          aria-live="polite"
          className="border border-ink bg-brut-red/15 px-4 py-3 text-sm text-brut-red-deep"
        >
          {state.formError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id={nameId}
          name="name"
          label="Org name"
          value={name}
          onChange={(e) => handleName(e.target.value)}
          placeholder="Speedy Cabs Ltd"
          error={fe.name?.[0]}
          required
        />
        <Field
          id={slugId}
          name="slug"
          label="Slug"
          value={slug}
          onChange={(e) => {
            const next = e.target.value;
            // Clearing the field resumes auto-derive from the org name so the
            // slug never gets stuck empty.
            setSlugEdited(next !== "");
            setSlug(next);
          }}
          placeholder="speedy-cabs"
          hint="Lowercase, hyphenated. Auto-derived from the org name."
          error={fe.slug?.[0]}
          required
        />
        <SelectField
          id={countryId}
          name="country"
          label="Country"
          value={country}
          onChange={setCountry}
          error={fe.country?.[0]}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Field
          id={emailId}
          name="contact_email"
          label="Primary contact email"
          type="email"
          inputMode="email"
          placeholder="owner@speedycabs.co.uk"
          error={fe.contact_email?.[0]}
          required
        />
        <SelectField
          id={adapterId}
          name="dispatch_adapter"
          label="Dispatch adapter"
          value={dispatchAdapter}
          onChange={setDispatchAdapter}
          error={fe.dispatch_adapter?.[0]}
        >
          {DISPATCH_ADAPTERS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SelectField>
        <Field
          id={companyId}
          name="dispatch_company_id"
          label="Dispatch company ID"
          placeholder="Optional"
          error={fe.dispatch_company_id?.[0]}
        />
      </div>

      <fieldset className="flex flex-col gap-5 border-[3px] border-ink bg-paper p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">Commercial model</legend>

        <SelectField
          id={modelId}
          name="plan_type"
          label="Plan"
          value={planType}
          onChange={(v) => setPlanType(v as PlanType)}
          error={fe.plan_type?.[0]}
        >
          {PLAN_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </SelectField>

        {planType === "custom" && (
          <div className="flex flex-col gap-5 border-[3px] border-ink bg-brut-yellow/10 p-4">
            <p className="font-display text-sm font-extrabold uppercase tracking-tight text-ink">
              Custom Full Throttle pack
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field id={`${modelId}-cpn`} name="custom_plan_name" label="Plan name"
                value={customPlanName} onChange={(e) => setCustomPlanName(e.target.value)}
                placeholder="Airport Pack" error={fe.custom_plan_name?.[0]} />
              <SelectField id={`${modelId}-cbm`} name="custom_billing_mode" label="Billing mode"
                value={billingMode} onChange={(v) => setBillingMode(v as "recurring" | "one_time")}
                error={fe.custom_billing_mode?.[0]}>
                <option value="recurring">Recurring (renews every validity period)</option>
                <option value="one_time">One-time prepaid pack</option>
              </SelectField>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="custom_includes_voice" checked={includesVoice}
                  onChange={(e) => setIncludesVoice(e.target.checked)} className="h-4 w-4 border-2 border-ink" />
                Include AI Voice
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="custom_includes_chat" checked={includesChat}
                  onChange={(e) => setIncludesChat(e.target.checked)} className="h-4 w-4 border-2 border-ink" />
                Include WhatsApp Suite
              </label>
            </div>
            {fe.custom_includes_voice?.[0] && (
              <p role="alert" className="text-xs text-brut-red-deep">{fe.custom_includes_voice[0]}</p>
            )}

            {includesVoice && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id={`${modelId}-ca`} name="custom_call_allowance" label="Number of calls (per period)"
                  type="number" min="0" value={callAllowance} onChange={(e) => setCallAllowance(e.target.value)} />
                <Field id={`${modelId}-ag`} name="custom_included_agents" label="Number of agents"
                  type="number" min="0" value={includedAgents} onChange={(e) => setIncludedAgents(e.target.value)} />
                <Field id={`${modelId}-ppc`} name="custom_price_per_call_gbp" label="Price per call (£, in-pack)"
                  type="number" step="0.01" min="0" value={pricePerCall} onChange={(e) => setPricePerCall(e.target.value)} />
                <Field id={`${modelId}-pp`} name="custom_plan_price_gbp" label="Plan / pack price (£)"
                  type="number" step="0.01" min="0" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)}
                  error={fe.custom_plan_price_gbp?.[0]} />
                <Field id={`${modelId}-xc`} name="custom_extra_credit_price_gbp" label="Per-call extra credit (£, overage)"
                  type="number" step="0.01" min="0" value={extraCredit} onChange={(e) => setExtraCredit(e.target.value)} />
                <Field id={`${modelId}-vd`} name="custom_validity_days" label="Pack validity (days from start)"
                  type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)}
                  error={fe.custom_validity_days?.[0]} />
              </div>
            )}
            {includesChat && (
              <Field id={`${modelId}-cm`} name="custom_chat_monthly_gbp" label="WhatsApp Suite monthly (£)"
                type="number" step="0.01" min="0" value={chatMonthly} onChange={(e) => setChatMonthly(e.target.value)}
                error={fe.custom_chat_monthly_gbp?.[0]} />
            )}
            <Field id={`${modelId}-sf`} name="custom_setup_fee_gbp" label="Setup fee (£, one-time)"
              type="number" step="0.01" min="0" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-[3px] border-ink bg-brut-lime/10 px-4 py-3 text-sm">
          <p className="font-medium text-gray-700">Price summary</p>
          {summaryChat !== null && <p className="text-ink">WhatsApp Suite: <span className="font-semibold">{formatPrice("GBP", summaryChat)}/mo</span></p>}
          {summaryVoice !== null && <p className="text-ink">AI Voice: <span className="font-semibold">{formatPrice("GBP", summaryVoice)}/mo</span></p>}
          <p className="text-ink">Setup (one-time): <span className="font-semibold">{formatPrice("GBP", summarySetup)}</span></p>
          <p className="text-ink">First invoice (setup + first period): <span className="font-semibold">{formatPrice("GBP", summaryFirst)}</span></p>
          <p className="text-xs text-gray-500">Prices in GBP. The tenant is emailed this invoice to pay.</p>
        </div>
      </fieldset>

      {/* Discount coupon. A 100%-off code comps setup + subscription and skips
          Stripe entirely; partial codes reduce the recorded prices above. */}
      <fieldset className="flex flex-col gap-2 border-[3px] border-ink bg-paper p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Discount coupon
        </legend>
        <Field
          id={couponId}
          name="coupon_code"
          label="Coupon code"
          placeholder="Optional, e.g. LAUNCH100"
          autoCapitalize="characters"
          hint="Applies a percentage discount. A 100%-off code fully comps the tenant (setup fee + subscription) and bypasses Stripe payment."
          error={fe.coupon_code?.[0]}
        />
      </fieldset>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer bg-brut-lime px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-brut-lime focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create tenant"}
        </button>
        <Link
          href="/admin/tenants"
          className="px-4 py-2 text-sm font-medium text-gray-600 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
