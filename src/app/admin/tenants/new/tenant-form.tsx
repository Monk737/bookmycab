"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { createTenant } from "../actions";
import { type TenantFormState } from "../provisioning";
import { slugify } from "@/lib/admin/plan-bands";
import {
  resolveNewModelPricing,
  type CommercialModel,
  type NewTierKey,
} from "@/lib/billing/pricing";
import { formatPrice } from "@/lib/marketing/pricing";
import { COUNTRIES } from "@/lib/billing/country";

const DISPATCH_ADAPTERS = [
  { value: "autocab", label: "AutoCab" },
  { value: "icabbi", label: "iCabbi" },
  { value: "cordic", label: "Cordic" },
] as const;

const COMMERCIAL_MODELS: { value: CommercialModel; label: string }[] = [
  { value: "chat", label: "Chat" },
  { value: "voice", label: "Voice" },
  { value: "double_decker", label: "Double Decker" },
];

const TIERS: { value: NewTierKey; label: string }[] = [
  { value: "ignition", label: "Ignition" },
  { value: "in_motion", label: "In Motion" },
  { value: "full_throttle", label: "Full Throttle" },
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
 * Tenant provisioning form (new commercial model). The slug auto-derives from
 * the org name until edited. The commercial-model selection (model + tiers +
 * channel mode) drives a live, read-only GBP price summary via
 * `resolveNewModelPricing`. Currency is always GBP. Chat-only Full Throttle is
 * quoted (no list price), so it exposes an editable monthly-price override.
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
  const chatTierId = useId();
  const voiceTierId = useId();
  const couponId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [country, setCountry] = useState<string>("GB");
  const [dispatchAdapter, setDispatchAdapter] = useState<string>("autocab");

  const [commercialModel, setCommercialModel] = useState<CommercialModel>("chat");
  const [chatTier, setChatTier] = useState<NewTierKey>("ignition");
  const [voiceTier, setVoiceTier] = useState<NewTierKey>("ignition");

  function handleName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  const fe = state.fieldErrors;

  const hasChat = commercialModel === "chat" || commercialModel === "double_decker";
  const hasVoice = commercialModel === "voice" || commercialModel === "double_decker";

  // Live price preview from the current selection. Pure + dependency-free.
  const resolved = resolveNewModelPricing({
    model: commercialModel,
    chatTier: hasChat ? chatTier : null,
    voiceTier: hasVoice ? voiceTier : null,
  });

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

      {/* Commercial model + tiers. Tier/channel selects render conditionally on
          the chosen model; pricing is previewed live below. */}
      <fieldset className="flex flex-col gap-5 border-[3px] border-ink bg-paper p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Commercial model
        </legend>

        <SelectField
          id={modelId}
          name="commercial_model"
          label="Product"
          value={commercialModel}
          onChange={(v) => setCommercialModel(v as CommercialModel)}
          error={fe.commercial_model?.[0]}
        >
          {COMMERCIAL_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {hasChat && (
            <>
              <SelectField
                id={chatTierId}
                name="chat_tier"
                label="Chat tier"
                value={chatTier}
                onChange={(v) => setChatTier(v as NewTierKey)}
                error={fe.chat_tier?.[0]}
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectField>
            </>
          )}

          {hasVoice && (
            <SelectField
              id={voiceTierId}
              name="voice_tier"
              label="Voice tier"
              value={voiceTier}
              onChange={(v) => setVoiceTier(v as NewTierKey)}
              error={fe.voice_tier?.[0]}
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>
          )}
        </div>

        {/* Live, read-only price summary computed from the selection. */}
        <div className="flex flex-col gap-1.5 border-[3px] border-ink bg-brut-lime/10 px-4 py-3 text-sm">
          <p className="font-medium text-gray-700">Price summary</p>
          {hasChat && (
            <p className="text-ink">
              Chat:{" "}
              <span className="font-semibold">
                {resolved.chatGbp === null
                  ? "—"
                  : `${formatPrice("GBP", resolved.chatGbp)}/mo`}
              </span>
              {commercialModel === "double_decker" && resolved.chatGbp !== null ? (
                <span className="ml-1 text-xs text-gray-500">(bundle discount applied)</span>
              ) : null}
            </p>
          )}
          {hasVoice && (
            <p className="text-ink">
              Voice:{" "}
              <span className="font-semibold">
                {resolved.voiceGbp === null
                  ? "—"
                  : `${formatPrice("GBP", resolved.voiceGbp)}/mo`}
              </span>
            </p>
          )}
          <p className="text-ink">
            Setup (one-time):{" "}
            <span className="font-semibold">
              {formatPrice("GBP", resolved.setupGbp)}
            </span>
          </p>
          <p className="text-xs text-gray-500">All prices billed monthly in GBP.</p>
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
