import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Must be unique on the page — used to wire `<label for>` and `aria-describedby`. */
  id: string;
  label: string;
  /** Inline validation/server error for this field. */
  error?: string | null;
};

/**
 * Labelled input with inline error.
 * Uses `aria-describedby` to associate the error message with the input for
 * screen readers, and `aria-invalid` when an error is present.
 */
export function Field({ id, label, error, className = "", ...inputProps }: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={[
          "rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
          error
            ? "border-red-400 bg-red-50 focus-visible:ring-red-500"
            : "border-slate-300 bg-white hover:border-slate-400",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
