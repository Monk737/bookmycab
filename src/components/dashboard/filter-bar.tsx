"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "search" | "date";
  options?: { value: string; label: string }[];
}

export function FilterBar({
  fields,
  values,
}: {
  fields: FilterField[];
  values: Record<string, string>;
}): React.JSX.Element {
  const router = useRouter();
  // Keep a mutable ref for debounced search values so the timeout closure can
  // always read the latest value without stale-capture.
  const pendingRef = useRef<Record<string, string>>({ ...values });

  // Sync incoming values into pendingRef whenever they change (e.g. URL update).
  useEffect(() => {
    pendingRef.current = { ...values };
  }, [values]);

  const push = useCallback(
    (updated: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(updated)) {
        if (v) params.set(k, v);
      }
      params.delete("page");
      router.replace(`?${params.toString()}`);
    },
    [router]
  );

  // Debounce handle for search inputs.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (field: FilterField, newValue: string) => {
      const updated = { ...pendingRef.current, [field.key]: newValue };
      pendingRef.current = updated;

      if (field.type === "search") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          push(pendingRef.current);
        }, 300);
      } else {
        push(updated);
      }
    },
    [push]
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((field) => {
        const id = `filter-${field.key}`;
        const currentValue = values[field.key] ?? "";

        return (
          <div key={field.key} className="flex flex-col gap-1">
            <label
              htmlFor={id}
              className="text-[11px] font-medium uppercase tracking-wider text-slate-600"
            >
              {field.label}
            </label>

            {field.type === "select" ? (
              <select
                id={id}
                name={field.key}
                value={currentValue}
                onChange={(e) => handleChange(field, e.target.value)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-shadow duration-150 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-800"
              >
                <option value="">All</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === "date" ? (
              <input
                id={id}
                type="date"
                name={field.key}
                value={currentValue}
                onChange={(e) => handleChange(field, e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-shadow duration-150 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-800"
              />
            ) : (
              /* search */
              <input
                id={id}
                type="search"
                name={field.key}
                defaultValue={currentValue}
                placeholder={`Search ${field.label.toLowerCase()}…`}
                onChange={(e) => handleChange(field, e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-shadow duration-150 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-800 min-w-[180px]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
