import type { ReactNode } from "react";

type AuthCardProps = {
  heading: string;
  /** Optional error message displayed in an aria-live alert banner. */
  error?: string | null;
  children: ReactNode;
};

/**
 * Shared card container for all auth pages.
 * Renders the BookMyCab wordmark, a page heading, an optional error banner,
 * and the card body (slot for form content). Brutalist: ink-framed paper
 * block on a hard offset shadow.
 */
export function AuthCard({ heading, error, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm border-[3px] border-ink bg-paper shadow-brut-xl">
      {/* Wordmark bar */}
      <div className="flex items-center justify-center gap-2 border-b-[3px] border-ink bg-brut-yellow px-8 py-4">
        <span className="font-logo text-base leading-none tracking-tight text-ink">
          BookMyCab
        </span>
        <span aria-hidden="true" className="inline-block h-3 w-3 border-2 border-ink bg-paper" />
      </div>

      <div className="px-8 py-8">
        {/* Page heading */}
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-ink">
          {heading}
        </h1>

        {/* Error banner, always present in the DOM so aria-live fires on update */}
        <div
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={
            error
              ? "mb-5 border-[3px] border-ink bg-brut-red px-4 py-3 text-sm font-bold text-ink"
              : "sr-only"
          }
        >
          {error ?? ""}
        </div>

        {children}
      </div>
    </div>
  );
}
