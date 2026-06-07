import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Must be unique on the page, used to wire `<label for>` and `aria-describedby`. */
  id: string;
  label: string;
  /** Inline validation/server error for this field. */
  error?: string | null;
};

/**
 * Labelled input with inline error.
 * Uses `aria-describedby` to associate the error message with the input for
 * screen readers, and `aria-invalid` when an error is present. Brutalist:
 * ink-framed input, hard focus outline, no glow.
 */
export function Field({ id, label, error, className = "", ...inputProps }: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-bold uppercase tracking-[0.08em] text-ink"
      >
        {label}
      </label>
      <input
        id={id}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={[
          "border-[3px] px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-gray-500",
          "transition-colors duration-150 tabular-nums",
          "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink",
          error
            ? "border-ink bg-brut-red/20"
            : "border-ink bg-paper",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs font-bold text-brut-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}
