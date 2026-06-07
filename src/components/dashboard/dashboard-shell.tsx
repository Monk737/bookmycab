"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { label: string; href: string };

const BASE_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Team", href: "/dashboard/team" },
  { label: "Billing", href: "/dashboard/billing" },
  { label: "Support", href: "/dashboard/support" },
];

/** True when `href` is the active route (exact for /dashboard, prefix otherwise). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Shared focus style for the ink sidebar, a hard paper outline.
const DARK_FOCUS =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Org-level dashboard shell. Persistent left sidebar (≥768px),
 * collapses to a drawer on mobile. Brutalist ink-black sidebar with a
 * yellow active block, the tenant surface accent (admin = cyan, demo = pink).
 */
export function DashboardShell({
  orgName,
  children,
  showAlerts,
  showCustomers,
  showLiveops,
  showDispatch,
  showIntel,
  showInvoicing,
  showReports,
  showConnect,
  showIntegrations,
  showCopilot,
}: {
  orgName: string;
  children: ReactNode;
  showAlerts?: boolean;
  showCustomers?: boolean;
  showLiveops?: boolean;
  showDispatch?: boolean;
  showIntel?: boolean;
  showInvoicing?: boolean;
  showReports?: boolean;
  showConnect?: boolean;
  showIntegrations?: boolean;
  showCopilot?: boolean;
}): React.JSX.Element {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const NAV_ITEMS = [
    ...BASE_NAV_ITEMS,
    ...(showAlerts ? [{ label: "Alerts", href: "/dashboard/alerts" }] : []),
    ...(showCustomers ? [{ label: "Customers", href: "/dashboard/customers" }] : []),
    ...(showLiveops ? [{ label: "Live ops", href: "/dashboard/liveops" }] : []),
    ...(showDispatch ? [{ label: "Dispatch", href: "/dashboard/dispatch" }] : []),
    ...(showIntel ? [{ label: "Intelligence", href: "/dashboard/intel" }] : []),
    ...(showInvoicing ? [{ label: "Invoicing", href: "/dashboard/invoicing" }] : []),
    ...(showReports ? [{ label: "Reports", href: "/dashboard/reports" }] : []),
    ...(showConnect ? [{ label: "Connect", href: "/dashboard/connect" }] : []),
    ...(showIntegrations ? [{ label: "Integrations", href: "/dashboard/integrations" }] : []),
    ...(showCopilot ? [{ label: "Copilot", href: "/dashboard/copilot" }] : []),
  ];

  const navLinks = (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setDrawerOpen(false)}
              className={`block px-3 py-2.5 text-sm font-bold uppercase tracking-[0.04em] transition-colors duration-150 ${DARK_FOCUS} ${
                active
                  ? "bg-brut-yellow text-ink"
                  : "text-gray-300 hover:bg-gray-800 hover:text-paper"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const wordmark = (onDark: boolean) => (
    <span
      className={`inline-flex items-center gap-1.5 font-logo text-sm leading-none tracking-tight ${
        onDark ? "text-paper" : "text-ink"
      }`}
    >
      BookMyCab
      <span
        aria-hidden="true"
        className={`inline-block h-2.5 w-2.5 border-2 bg-brut-yellow ${
          onDark ? "border-paper" : "border-ink"
        }`}
      />
    </span>
  );

  const signOutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className={`w-full cursor-pointer border-2 border-gray-700 px-3 py-2.5 text-left text-sm font-bold uppercase tracking-[0.04em] text-gray-300 transition-colors duration-150 hover:border-paper hover:bg-gray-800 hover:text-paper ${DARK_FOCUS}`}
      >
        Sign out
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b-[3px] border-ink bg-paper px-4 md:hidden">
        {wordmark(false)}
        <div className="flex items-center gap-3">
          <span className="max-w-[140px] truncate text-xs font-semibold text-gray-600">{orgName}</span>
          <button
            type="button"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
            className="brut-focus cursor-pointer border-[3px] border-ink bg-paper p-1.5 text-ink shadow-brut-sm transition-colors duration-150"
          >
            {drawerOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="square"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="square"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 md:hidden motion-safe:transition-opacity duration-200"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r-[3px] border-ink bg-ink text-gray-100 transition-transform duration-200 md:hidden motion-reduce:transition-none ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation drawer"
      >
        <div className="border-b-[3px] border-gray-800 px-5 py-5">
          {wordmark(true)}
          <p className="mt-2 truncate text-xs font-semibold text-gray-400">{orgName}</p>
        </div>
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks}
        </nav>
        <div className="border-t-[3px] border-gray-800 px-3 py-4">{signOutButton}</div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r-[3px] border-ink bg-ink text-gray-100 md:flex">
        <div className="border-b-[3px] border-gray-800 px-5 py-5">
          {wordmark(true)}
          <p className="mt-2 truncate text-xs font-semibold text-gray-400">{orgName}</p>
        </div>

        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks}
        </nav>

        <div className="border-t-[3px] border-gray-800 px-3 py-4">{signOutButton}</div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
