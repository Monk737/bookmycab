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
 * and the card body (slot for form content).
 */
export function AuthCard({ heading, error, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
      {/* Wordmark */}
      <div className="mb-8 text-center">
        <span className="text-xl font-semibold tracking-tight text-slate-900">
          Cabby<span className="text-indigo-600">Bot</span>
        </span>
      </div>

      {/* Page heading */}
      <h1 className="mb-6 text-center text-2xl font-semibold text-slate-900">
        {heading}
      </h1>

      {/* Error banner — always present in the DOM so aria-live fires on update */}
      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={
          error
            ? "mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            : "sr-only"
        }
      >
        {error ?? ""}
      </div>

      {children}
    </div>
  );
}
