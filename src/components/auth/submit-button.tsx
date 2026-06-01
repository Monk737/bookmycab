"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
};

/**
 * Form submit button that reads `useFormStatus` to disable itself and show a
 * loading label while the parent form action is in-flight.
 */
export function SubmitButton({ label, pendingLabel = "Please wait…" }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={[
        "mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white",
        "bg-indigo-600 transition-colors duration-150",
        "hover:bg-indigo-700 active:bg-indigo-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "cursor-pointer",
      ].join(" ")}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
