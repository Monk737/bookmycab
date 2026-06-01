"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { createTenant, type TenantFormState } from "../actions";
import {
  PLAN_BANDS,
  planBandLabel,
  planBandMonthlyPrice,
  slugify,
  type PlanBand,
} from "@/lib/admin/plan-bands";
import { CURRENCIES, type Currency } from "@/lib/marketing/pricing";

const DISPATCH_ADAPTERS = [
  { value: "autocab", label: "AutoCab" },
  { value: "icabbi", label: "iCabbi" },
  { value: "cordic", label: "Cordic" },
] as const;

const initialState: TenantFormState = { fieldErrors: {}, formError: null };

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40";

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
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-describedby={[error ? errorId : null, hint ? hintId : null]
          .filter(Boolean)
          .join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/40" : ""}`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
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
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${error ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/40" : ""}`}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Tenant provisioning form. Slug auto-derives from the org name until the staff
 * member edits it manually; monthly price prefills from the selected plan band +
 * currency (blank for Custom) and stays editable.
 */
export function TenantForm() {
  const [state, formAction, pending] = useActionState(createTenant, initialState);

  const nameId = useId();
  const slugId = useId();
  const countryId = useId();
  const planId = useId();
  const currencyId = useId();
  const adapterId = useId();
  const companyId = useId();
  const emailId = useId();
  const startId = useId();
  const priceId = useId();
  const stripeId = useId();
  const setupFeeId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [planBand, setPlanBand] = useState<PlanBand>("A-Single");
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [dispatchAdapter, setDispatchAdapter] = useState<string>("autocab");
  const [price, setPrice] = useState<string>(
    () => String(planBandMonthlyPrice("A-Single", "GBP") ?? ""),
  );
  const [priceEdited, setPriceEdited] = useState(false);

  function handleName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  // Prefill the price from band+currency unless the staff member typed their own.
  function syncPrice(band: PlanBand, cur: Currency) {
    if (priceEdited) return;
    const p = planBandMonthlyPrice(band, cur);
    setPrice(p === null ? "" : String(p));
  }

  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
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
            setSlugEdited(true);
            setSlug(e.target.value);
          }}
          placeholder="speedy-cabs"
          hint="Lowercase, hyphenated. Auto-derived from the org name."
          error={fe.slug?.[0]}
          required
        />
        <Field
          id={countryId}
          name="country"
          label="Country"
          placeholder="United Kingdom"
          error={fe.country?.[0]}
          required
        />
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
          id={planId}
          name="plan_band"
          label="Plan band"
          value={planBand}
          onChange={(v) => {
            const band = v as PlanBand;
            setPlanBand(band);
            syncPrice(band, currency);
          }}
          error={fe.plan_band?.[0]}
        >
          {PLAN_BANDS.map((b) => (
            <option key={b} value={b}>
              {planBandLabel(b)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={currencyId}
          name="currency"
          label="Currency"
          value={currency}
          onChange={(v) => {
            const cur = v as Currency;
            setCurrency(cur);
            syncPrice(planBand, cur);
          }}
          error={fe.currency?.[0]}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
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
        <Field
          id={startId}
          name="contract_start"
          label="Contract start"
          type="date"
          error={fe.contract_start?.[0]}
        />
        <Field
          id={priceId}
          name="monthly_price"
          label="Monthly price"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => {
            setPriceEdited(true);
            setPrice(e.target.value);
          }}
          hint={
            planBand === "Custom"
              ? "Custom band has no fixed price — enter the quoted amount."
              : "Prefilled from plan band + currency. Editable."
          }
          placeholder="0"
          error={fe.monthly_price?.[0]}
        />
        <Field
          id={stripeId}
          name="stripe_customer_id"
          label="Stripe customer ID"
          placeholder="Optional (Epic 8)"
          error={fe.stripe_customer_id?.[0]}
        />
        <Field
          id={setupFeeId}
          name="setup_fee"
          label="Setup fee amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Optional"
          hint="Recorded as an unpaid setup fee."
          error={fe.setup_fee?.[0]}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create tenant"}
        </button>
        <Link
          href="/admin/tenants"
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 outline-none transition-colors hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
