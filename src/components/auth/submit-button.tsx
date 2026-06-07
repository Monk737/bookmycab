"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
};

/**
 * Form submit button that reads `useFormStatus` to disable itself and show a
 * loading label while the parent form action is in-flight. Brutalist yellow
 * primary block with press physics.
 */
export function SubmitButton({ label, pendingLabel = "Please wait…" }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={[
        "brut-press brut-focus mt-2 w-full border-[3px] border-ink bg-brut-yellow px-4 py-3",
        "text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-brut",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
        "cursor-pointer",
      ].join(" ")}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
