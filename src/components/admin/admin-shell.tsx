"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Health", href: "/admin/health" },
  { label: "Usage", href: "/admin/usage" },
  { label: "Tenants", href: "/admin/tenants" },
  { label: "Plans", href: "/admin/plans" },
  { label: "Rollouts", href: "/admin/rollouts" },
  { label: "Platform", href: "/admin/platform" },
  { label: "Benchmarks", href: "/admin/benchmarks" },
  { label: "Guardrails", href: "/admin/guardrails" },
  { label: "Channel review", href: "/admin/channel-review" },
  { label: "Automations", href: "/admin/automations" },
  { label: "Build Queue", href: "/admin/build-queue" },
  { label: "Credentials", href: "/admin/credentials" },
  { label: "Billing", href: "/admin/billing" },
  { label: "Coupons", href: "/admin/coupons" },
  { label: "Impersonate", href: "/admin/impersonate" },
];

/** True when `href` is the active route (exact for /admin, prefix otherwise). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const DARK_FOCUS =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Internal operational console shell. Persistent left brutalist ink sidebar
 * with a CYAN active block, the staff surface accent, deliberately distinct
 * from the tenant dashboard (yellow) and demo (pink). Staff-only.
 */
export function AdminShell({
  children,
  banner,
}: {
  children: ReactNode;
  /** Optional full-width slot rendered above the padded content (e.g. the impersonation banner). */
  banner?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="flex w-60 shrink-0 flex-col border-r-[3px] border-ink bg-ink text-gray-300">
        <div className="border-b-[3px] border-gray-800 px-5 py-5">
          <span className="inline-flex items-center gap-1.5 font-logo text-sm leading-none tracking-tight text-paper">
            BookMyCab
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 border-2 border-paper bg-brut-cyan" />
          </span>
          <span className="mt-2.5 inline-flex items-center gap-1.5 border-2 border-ink bg-brut-cyan px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
            <span aria-hidden="true" className="status-pulse h-1.5 w-1.5 bg-ink" />
            FlowMo Staff
          </span>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block px-3 py-2 text-sm font-bold uppercase tracking-[0.04em] transition-colors duration-150 ${DARK_FOCUS} ${
                      active
                        ? "bg-brut-cyan text-ink"
                        : "text-gray-400 hover:bg-gray-800 hover:text-paper"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t-[3px] border-gray-800 px-3 py-4">
          <form action={signOut}>
            <button
              type="submit"
              className={`w-full cursor-pointer border-2 border-gray-700 px-3 py-2 text-left text-sm font-bold uppercase tracking-[0.04em] text-gray-400 transition-colors duration-150 hover:border-paper hover:bg-gray-800 hover:text-paper ${DARK_FOCUS}`}
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {banner}
        <div className="px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
