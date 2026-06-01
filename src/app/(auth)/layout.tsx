import type { ReactNode } from "react";

/**
 * Auth shell layout — full-height centered container with a calm neutral
 * background. Intentionally stripped of the marketing nav/footer.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      {children}
    </div>
  );
}
