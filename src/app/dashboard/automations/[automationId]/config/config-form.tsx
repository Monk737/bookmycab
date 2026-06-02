"use client";

import { useState } from "react";
import Link from "next/link";
import type { AutomationConfig, AutomationConfigInput } from "@/lib/dashboard/config-types";

const VEHICLE_OPTIONS = [
  "Saloon",
  "Estate",
  "MPV",
  "8-Seater",
  "Wheelchair",
] as const;

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polish" },
  { code: "ur", label: "Urdu" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "es", label: "Spanish" },
  { code: "ar", label: "Arabic" },
];

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

type DayHours = { open: string; close: string; closed: boolean };

function parseDayHours(
  opening_hours: Record<string, [string, string][]> | undefined,
  day: string,
): DayHours {
  const slots = opening_hours?.[day];
  if (!slots || slots.length === 0) return { open: "09:00", close: "17:00", closed: true };
  return { open: slots[0][0], close: slots[0][1], closed: false };
}

function buildOpeningHours(days: Record<string, DayHours>): Record<string, [string, string][]> {
  const result: Record<string, [string, string][]> = {};
  for (const [key, val] of Object.entries(days)) {
    result[key] = val.closed ? [] : [[val.open, val.close]];
  }
  return result;
}

interface Props {
  orgId: string;
  automationId: string;
  initialConfig: AutomationConfig;
  channels: { type: string }[];
  canEdit: boolean;
}

const inputBase =
  "w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";

const textareaBase =
  "w-full px-4 py-3 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 resize-y disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";

export function ConfigForm({
  orgId,
  automationId,
  initialConfig,
  channels,
  canEdit,
}: Props) {
  // Welcome messages — one per attached channel
  const [welcomeMessages, setWelcomeMessages] = useState<Record<string, string>>(
    initialConfig.welcome_messages ?? {},
  );

  // Vehicle types
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(
    initialConfig.vehicle_types ?? [],
  );

  // Service area
  const [serviceArea, setServiceArea] = useState<string>(
    initialConfig.service_area ?? "",
  );

  // Opening hours — initialise per day
  const [dayHours, setDayHours] = useState<Record<string, DayHours>>(() => {
    const h: Record<string, DayHours> = {};
    for (const { key } of DAYS) {
      h[key] = parseDayHours(initialConfig.opening_hours, key);
    }
    return h;
  });

  // Brand colours
  const [primaryColour, setPrimaryColour] = useState<string>(
    initialConfig.brand_colours?.primary ?? "#1E40AF",
  );
  const [secondaryColour, setSecondaryColour] = useState<string>(
    initialConfig.brand_colours?.secondary ?? "#F59E0B",
  );

  // Languages
  const [languages, setLanguages] = useState<string[]>(
    initialConfig.languages ?? ["en"],
  );

  // Ask driver note
  const [askDriverNote, setAskDriverNote] = useState<boolean>(
    initialConfig.ask_driver_note ?? false,
  );

  // Submit state
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  function toggleVehicle(v: string) {
    setVehicleTypes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
  }

  function updateDayHours(day: string, field: keyof DayHours, value: string | boolean) {
    setDayHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveStatus("idle");
    setErrorMsg("");

    const payload: AutomationConfigInput = {
      welcome_messages: welcomeMessages,
      vehicle_types: vehicleTypes,
      service_area: serviceArea || null,
      opening_hours: buildOpeningHours(dayHours),
      brand_colours: { primary: primaryColour, secondary: secondaryColour },
      languages,
      ask_driver_note: askDriverNote,
    };

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-blue-900">Bot Configuration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the behaviour and branding of your automation.
        </p>
      </div>

      {/* Read-only banner */}
      {!canEdit && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Only Owners and Admins can edit configuration. You are viewing in read-only mode.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Welcome Messages ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Welcome Messages
          </h2>
          {channels.length === 0 ? (
            <p className="text-sm text-slate-400">No channels are currently attached to this automation.</p>
          ) : (
            channels.map((ch) => (
              <div key={ch.type} className="space-y-1">
                <label
                  htmlFor={`welcome-${ch.type}`}
                  className="block text-sm font-medium text-slate-700 capitalize"
                >
                  {ch.type}
                </label>
                <textarea
                  id={`welcome-${ch.type}`}
                  rows={3}
                  disabled={!canEdit}
                  className={textareaBase}
                  value={welcomeMessages[ch.type] ?? ""}
                  onChange={(e) =>
                    setWelcomeMessages((prev) => ({
                      ...prev,
                      [ch.type]: e.target.value,
                    }))
                  }
                  placeholder={`Welcome message for ${ch.type} users`}
                />
              </div>
            ))
          )}
          <p className="text-xs text-slate-400">
            Available variables: <code className="font-mono">{"{{company_name}}"}</code>,{" "}
            <code className="font-mono">{"{{opening_hours}}"}</code>,{" "}
            <code className="font-mono">{"{{contact_number}}"}</code>
          </p>
        </section>

        {/* ── Vehicle Types ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Vehicle Types
          </h2>
          <div className="flex flex-wrap gap-3">
            {VEHICLE_OPTIONS.map((v) => {
              const checked = vehicleTypes.includes(v);
              return (
                <label
                  key={v}
                  htmlFor={`vehicle-${v}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors duration-150 cursor-pointer select-none ${
                    checked
                      ? "bg-blue-800 border-blue-800 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                  } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    id={`vehicle-${v}`}
                    checked={checked}
                    disabled={!canEdit}
                    onChange={() => toggleVehicle(v)}
                    className="sr-only"
                  />
                  {v}
                </label>
              );
            })}
          </div>
        </section>

        {/* ── Service Area ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Service Area
          </h2>
          <div className="space-y-1">
            <label htmlFor="service-area" className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="service-area"
              rows={4}
              disabled={!canEdit}
              className={textareaBase}
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              placeholder="Describe the areas your service covers, e.g. all of Greater London, M25 corridor..."
            />
          </div>
        </section>

        {/* ── Opening Hours ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Opening Hours
          </h2>
          <div className="space-y-3">
            {DAYS.map(({ key, label }) => {
              const day = dayHours[key];
              return (
                <div key={key} className="grid grid-cols-[120px_1fr] items-center gap-4 sm:gap-6">
                  <label
                    htmlFor={`day-closed-${key}`}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      id={`day-closed-${key}`}
                      checked={!day.closed}
                      disabled={!canEdit}
                      onChange={(e) => updateDayHours(key, "closed", !e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800 disabled:cursor-not-allowed cursor-pointer"
                    />
                    {label}
                  </label>
                  {day.closed ? (
                    <span className="text-sm text-slate-400">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="space-y-0.5">
                        <label htmlFor={`day-open-${key}`} className="sr-only">
                          {label} open time
                        </label>
                        <input
                          type="time"
                          id={`day-open-${key}`}
                          disabled={!canEdit}
                          value={day.open}
                          onChange={(e) => updateDayHours(key, "open", e.target.value)}
                          className={`${inputBase} w-32`}
                        />
                      </div>
                      <span className="text-slate-400 text-sm">to</span>
                      <div className="space-y-0.5">
                        <label htmlFor={`day-close-${key}`} className="sr-only">
                          {label} close time
                        </label>
                        <input
                          type="time"
                          id={`day-close-${key}`}
                          disabled={!canEdit}
                          value={day.close}
                          onChange={(e) => updateDayHours(key, "close", e.target.value)}
                          className={`${inputBase} w-32`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Brand Colours ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Brand Colours
          </h2>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1">
              <label htmlFor="brand-primary" className="block text-sm font-medium text-slate-700">
                Primary
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="brand-primary"
                  disabled={!canEdit}
                  value={primaryColour}
                  onChange={(e) => setPrimaryColour(e.target.value)}
                  className="w-10 h-10 rounded border border-slate-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-0.5"
                />
                <input
                  type="text"
                  aria-label="Primary colour hex"
                  disabled={!canEdit}
                  value={primaryColour}
                  onChange={(e) => setPrimaryColour(e.target.value)}
                  className={`${inputBase} w-32 font-mono`}
                  maxLength={7}
                  placeholder="#000000"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="brand-secondary" className="block text-sm font-medium text-slate-700">
                Secondary
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="brand-secondary"
                  disabled={!canEdit}
                  value={secondaryColour}
                  onChange={(e) => setSecondaryColour(e.target.value)}
                  className="w-10 h-10 rounded border border-slate-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-0.5"
                />
                <input
                  type="text"
                  aria-label="Secondary colour hex"
                  disabled={!canEdit}
                  value={secondaryColour}
                  onChange={(e) => setSecondaryColour(e.target.value)}
                  className={`${inputBase} w-32 font-mono`}
                  maxLength={7}
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Languages ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Languages
          </h2>
          <div className="flex flex-wrap gap-3">
            {LANGUAGE_OPTIONS.map(({ code, label }) => {
              const checked = languages.includes(code);
              return (
                <label
                  key={code}
                  htmlFor={`lang-${code}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors duration-150 cursor-pointer select-none ${
                    checked
                      ? "bg-blue-800 border-blue-800 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                  } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    id={`lang-${code}`}
                    checked={checked}
                    disabled={!canEdit}
                    onChange={() => toggleLanguage(code)}
                    className="sr-only"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </section>

        {/* ── Driver Note Prompt ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6">
          <label
            htmlFor="ask-driver-note"
            className="flex items-center justify-between cursor-pointer"
          >
            <div>
              <span className="text-sm font-semibold text-blue-900">Driver Note Prompt</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Ask customers if they have any notes for the driver before confirming.
              </p>
            </div>
            <div className="relative ml-4">
              <input
                type="checkbox"
                id="ask-driver-note"
                checked={askDriverNote}
                disabled={!canEdit}
                onChange={(e) => setAskDriverNote(e.target.checked)}
                className="sr-only"
              />
              <div
                onClick={() => canEdit && setAskDriverNote((v) => !v)}
                role="switch"
                aria-checked={askDriverNote}
                aria-label="Ask driver note"
                tabIndex={canEdit ? 0 : -1}
                onKeyDown={(e) => {
                  if (canEdit && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setAskDriverNote((v) => !v);
                  }
                }}
                className={`w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-800 ${
                  askDriverNote ? "bg-blue-800" : "bg-slate-200"
                } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 mt-1 ${
                    askDriverNote ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
            </div>
          </label>
        </section>

        {/* ── Structural Change ── */}
        <section className="rounded-xl shadow-sm bg-white border border-slate-100 p-6 space-y-2">
          <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
            Flow Logic
          </h2>
          <p className="text-sm text-slate-600">
            The conversation flow for your automation is bespoke and managed by the CabbyBot
            engineering team.
          </p>
          <Link
            href="/dashboard/support"
            className="inline-block mt-2 text-sm font-medium text-blue-800 hover:text-blue-600 underline underline-offset-2 transition-colors duration-150 cursor-pointer"
          >
            Request a structural change
          </Link>
        </section>

        {/* ── Save Footer ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
          <p className="text-xs text-slate-400">
            Changes apply on the automation&apos;s next run.
          </p>
          <div className="flex items-center gap-4">
            {saveStatus === "saved" && (
              <span className="text-sm font-medium text-green-600">Saved</span>
            )}
            {saveStatus === "error" && (
              <span className="text-sm font-medium text-red-600">{errorMsg}</span>
            )}
            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
