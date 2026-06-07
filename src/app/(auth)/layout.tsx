import type { ReactNode } from "react";

/**
 * Auth shell layout, full-height centered container on the flat brutalist
 * canvas with a hard repeating grid backdrop. Stripped of marketing nav/footer.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-canvas px-4 py-16"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(10,10,10,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(10,10,10,0.06) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {children}
    </div>
  );
}
