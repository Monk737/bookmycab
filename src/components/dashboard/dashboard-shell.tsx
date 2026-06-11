"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { label: string; href: string; icon: ReactNode; group: "primary" | "account" };

/* Square-cap line icons, matching the brutalist stroke of the menu glyphs. */
const ico = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.25}
    strokeLinecap="square"
    strokeLinejoin="miter"
    className="h-[18px] w-[18px] shrink-0"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", group: "primary", icon: ico(<><path d="M4 13h7V4H4zM13 20h7v-9h-7zM13 4v3h7V4zM4 17v3h7v-3z" /></>) },
  { label: "Chat", href: "/dashboard/chat", group: "primary", icon: ico(<path d="M4 4h16v11H8l-4 4z" />) },
  { label: "Voice", href: "/dashboard/voice", group: "primary", icon: ico(<><path d="M12 3v18" /><path d="M8 7v10M16 7v10M4 10v4M20 10v4" /></>) },
  { label: "Billing", href: "/dashboard/billing", group: "account", icon: ico(<><path d="M3 6h18v12H3z" /><path d="M3 10h18" /></>) },
  { label: "Team", href: "/dashboard/team", group: "account", icon: ico(<><path d="M3 20a5 5 0 0110 0M8 4a3 3 0 110 6 3 3 0 010-6Z" /><path d="M15 20a5 5 0 015-5M16 5a3 3 0 110 6" /></>) },
  { label: "Support", href: "/dashboard/support", group: "account", icon: ico(<><path d="M4 5h16v11H7l-3 3z" /><path d="M9 9h6M9 12h4" /></>) },
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
 * Org-level dashboard shell. Persistent left sidebar (≥768px), collapses to a
 * drawer on mobile. Brutalist ink-black sidebar with a yellow active block.
 * Two nav groups: the products (Overview / Chat / Voice) and account (Billing /
 * Team / Support).
 */
export function DashboardShell({ orgName, children }: { orgName: string; children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const renderItems = (items: NavItem[]) => (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 border-2 px-3 py-2.5 text-sm font-bold uppercase tracking-[0.04em] transition-[background-color,color] duration-150 ${DARK_FOCUS} ${
                active
                  ? "border-ink bg-brut-yellow text-ink shadow-brut-sm"
                  : "border-transparent text-gray-300 hover:bg-gray-800 hover:text-paper"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const navLinks = (
    <div className="space-y-5">
      <div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Products</p>
        {renderItems(NAV_ITEMS.filter((i) => i.group === "primary"))}
      </div>
      <div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Account</p>
        {renderItems(NAV_ITEMS.filter((i) => i.group === "account"))}
      </div>
    </div>
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
        className={`inline-block h-2.5 w-2.5 border-2 bg-brut-yellow ${onDark ? "border-paper" : "border-ink"}`}
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className="h-5 w-5" aria-hidden="true">
              {drawerOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/50 duration-200 motion-safe:transition-opacity md:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r-[3px] border-ink bg-ink text-gray-100 transition-transform duration-200 motion-reduce:transition-none md:hidden ${
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
      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
