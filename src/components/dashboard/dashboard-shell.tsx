"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
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

/**
 * Org-level dashboard shell. Persistent left sidebar (≥768px),
 * collapses to a drawer on mobile. Blue-800 palette — distinct from
 * the admin (zinc/dark) and marketing (#FFD400) surfaces.
 */
export function DashboardShell({
  orgName,
  children,
}: {
  orgName: string;
  children: ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navLinks = (
    <ul className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setDrawerOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950 ${
                active
                  ? "bg-blue-800 text-white"
                  : "text-blue-200 hover:bg-blue-800/60 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <span className="text-sm font-semibold tracking-tight">
          Cabby<span className="text-blue-800">Bot</span>
        </span>
        <div className="flex items-center gap-3">
          <span className="truncate text-xs text-slate-600 max-w-[140px]">{orgName}</span>
          <button
            type="button"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
            className="cursor-pointer rounded-md p-1.5 text-slate-600 transition-colors duration-150 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:outline-none"
          >
            {drawerOpen ? (
              /* X icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              /* Hamburger icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
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
          className="fixed inset-0 z-20 bg-black/40 md:hidden motion-safe:transition-opacity duration-200"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-blue-950 text-blue-100 transition-transform duration-200 md:hidden motion-reduce:transition-none ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation drawer"
      >
        <div className="border-b border-blue-900 px-5 py-5">
          <p className="text-sm font-semibold tracking-tight text-white">
            Cabby<span className="text-amber-400">Bot</span>
          </p>
          <p className="mt-1 truncate text-xs text-blue-300">{orgName}</p>
        </div>
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks}
        </nav>
        <div className="border-t border-blue-900 px-3 py-4">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium text-blue-300 outline-none transition-colors duration-150 hover:bg-blue-800/60 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-blue-900 bg-blue-950 text-blue-100">
        <div className="border-b border-blue-900 px-5 py-5">
          <p className="text-sm font-semibold tracking-tight text-white">
            Cabby<span className="text-amber-400">Bot</span>
          </p>
          <p className="mt-1 truncate text-xs text-blue-300">{orgName}</p>
        </div>

        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks}
        </nav>

        <div className="border-t border-blue-900 px-3 py-4">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium text-blue-300 outline-none transition-colors duration-150 hover:bg-blue-800/60 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
