"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { VoiceMarkLine } from "@/components/marketing/product-marks";

type NavGroup = "main" | "intelligence" | "briefing" | "account";
type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  group: NavGroup;
  /** Match only the exact path (for parents whose sub-pages are listed separately). */
  exact?: boolean;
};

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

const voiceMark = <VoiceMarkLine className="h-5 w-5 shrink-0" />;
const chartIcon = ico(<path d="M3 20h18M6 20v-5M11 20V8M16 20v-10" />);
const sparkIcon = ico(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />);

/* Section labels for the grouped rail — each a distinct ribbon colour. */
const GROUPS: { key: NavGroup; label: string; color: string }[] = [
  { key: "main", label: "Main", color: "bg-brut-yellow" },
  { key: "intelligence", label: "Intelligence", color: "bg-brut-cyan" },
  { key: "briefing", label: "AI Weekly Briefing", color: "bg-brut-lime" },
  { key: "account", label: "Account", color: "bg-brut-violet" },
];

const NAV_ITEMS: NavItem[] = [
  // Main — the two products + the org overview.
  { label: "Overview", href: "/dashboard", group: "main", exact: true, icon: ico(<><path d="M4 13h7V4H4zM13 20h7v-9h-7zM13 4v3h7V4zM4 17v3h7v-3z" /></>) },
  { label: "Chat", href: "/dashboard/chat", group: "main", exact: true, icon: ico(<path d="M4 4h16v11H8l-4 4z" />) },
  { label: "Voice", href: "/dashboard/voice", group: "main", exact: true, icon: voiceMark },
  // Intelligence — booking/call analytics per product.
  { label: "Chat Intelligence", href: "/dashboard/chat/intelligence", group: "intelligence", icon: chartIcon },
  { label: "AI Voice Intelligence", href: "/dashboard/voice/intelligence", group: "intelligence", icon: chartIcon },
  // AI Weekly Briefing — the Monday-morning LLM read per product.
  { label: "Chat Briefing", href: "/dashboard/chat/briefing", group: "briefing", icon: sparkIcon },
  { label: "Voice Briefing", href: "/dashboard/voice/briefing", group: "briefing", icon: sparkIcon },
  // Account.
  { label: "Billing", href: "/dashboard/billing", group: "account", icon: ico(<><path d="M3 6h18v12H3z" /><path d="M3 10h18" /></>) },
  { label: "Team", href: "/dashboard/team", group: "account", icon: ico(<><path d="M3 20a5 5 0 0110 0M8 4a3 3 0 110 6 3 3 0 010-6Z" /><path d="M15 20a5 5 0 015-5M16 5a3 3 0 110 6" /></>) },
  { label: "Support", href: "/dashboard/support", group: "account", icon: ico(<><path d="M4 5h16v11H7l-3 3z" /><path d="M9 9h6M9 12h4" /></>) },
];

/** True when an item is the active route. Parents with listed sub-pages match
 *  exactly; leaves match exact-or-prefix so deeper routes still highlight them. */
function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Shared focus style for the ink sidebar, a hard paper outline.
const DARK_FOCUS =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Org-level dashboard shell. Fixed full-height layout: the sidebar stays put and
 * only the main column scrolls. The desktop rail collapses to an icon-only strip
 * via a persisted toggle; on mobile it becomes a hamburger drawer. Brutalist
 * ink-black sidebar with a yellow active block.
 */
export function DashboardShell({ orgName, children, notifications }: { orgName: string; children: ReactNode; notifications?: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted desktop collapse preference once mounted.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem("bmc-dash-collapsed") === "1");
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("bmc-dash-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const renderItems = (items: NavItem[], compact: boolean) => (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={compact ? item.label : undefined}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 border-2 py-2.5 text-sm font-bold uppercase tracking-[0.04em] transition-[background-color,color] duration-150 ${compact ? "justify-center px-2" : "px-3"} ${DARK_FOCUS} ${
                active
                  ? "border-ink bg-brut-yellow text-ink shadow-brut-sm"
                  : "border-transparent text-gray-300 hover:bg-gray-800 hover:text-paper"
              }`}
            >
              {item.icon}
              <span className={compact ? "sr-only" : ""}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  /* Grouped rail: Main / Intelligence / AI Weekly Briefing / Account. When the
     desktop rail is collapsed, the section labels drop to thin ink dividers so
     the groups stay legible as icon clusters. */
  const navLinks = (compact: boolean) => (
    <div className="space-y-5">
      {GROUPS.map((g, i) => {
        const items = NAV_ITEMS.filter((it) => it.group === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key}>
            {compact ? (
              i > 0 ? <div aria-hidden="true" className="mx-2 mb-2 border-t-2 border-gray-800" /> : null
            ) : (
              <div className="px-2 pb-2.5">
                <span className={`inline-block -rotate-1 border-2 border-ink ${g.color} px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-ink shadow-brut-sm`}>
                  {g.label}
                </span>
              </div>
            )}
            {renderItems(items, compact)}
          </div>
        );
      })}
    </div>
  );

  const wordmark = (onDark: boolean, markOnly = false) => (
    <span
      className={`inline-flex items-center gap-1.5 font-logo text-sm leading-none tracking-tight ${
        onDark ? "text-paper" : "text-ink"
      }`}
    >
      {!markOnly && "BookMyCab"}
      <span
        aria-hidden="true"
        className={`inline-block h-2.5 w-2.5 border-2 bg-brut-yellow ${onDark ? "border-paper" : "border-ink"}`}
      />
    </span>
  );

  const signOutButton = (compact: boolean) => (
    <form action={signOut}>
      <button
        type="submit"
        title={compact ? "Sign out" : undefined}
        className={`flex w-full cursor-pointer items-center gap-3 border-2 border-gray-700 py-2.5 text-left text-sm font-bold uppercase tracking-[0.04em] text-gray-300 transition-colors duration-150 hover:border-paper hover:bg-gray-800 hover:text-paper ${compact ? "justify-center px-2" : "px-3"} ${DARK_FOCUS}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-[18px] w-[18px] shrink-0" aria-hidden="true"><path d="M14 4h5v16h-5M11 8l-4 4 4 4M7 12h10" /></svg>
        <span className={compact ? "sr-only" : ""}>Sign out</span>
      </button>
    </form>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-canvas text-ink">
      {/* Mobile drawer overlay (above any demo banner, z-50) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[55] bg-ink/50 duration-200 motion-safe:transition-opacity md:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 z-[60] flex w-64 flex-col border-r-[3px] border-ink bg-ink text-gray-100 transition-transform duration-200 motion-reduce:transition-none md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation drawer"
      >
        <div className="border-b-[3px] border-gray-800 px-5 py-5">
          {wordmark(true)}
          <p className="mt-2 truncate text-xs font-semibold text-gray-400">{orgName}</p>
        </div>
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks(false)}
        </nav>
        <div className="border-t-[3px] border-gray-800 px-3 py-4">{signOutButton(false)}</div>
      </div>

      {/* Desktop sidebar (fixed height; only its nav scrolls) */}
      <aside className={`hidden shrink-0 flex-col border-r-[3px] border-ink bg-ink text-gray-100 transition-[width] duration-200 motion-reduce:transition-none md:flex ${collapsed ? "w-16" : "w-60"}`}>
        <div className={`flex items-center border-b-[3px] border-gray-800 py-5 ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          {collapsed ? wordmark(true, true) : (
            <div className="min-w-0">
              {wordmark(true)}
              <p className="mt-2 truncate text-xs font-semibold text-gray-400">{orgName}</p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={toggleCollapsed}
              className={`shrink-0 cursor-pointer border-2 border-gray-700 p-1 text-gray-300 transition-colors hover:border-paper hover:bg-gray-800 hover:text-paper ${DARK_FOCUS}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className="h-4 w-4" aria-hidden="true"><path d="M14 6l-6 6 6 6" /></svg>
            </button>
          )}
        </div>
        {collapsed && (
          <div className="flex justify-center border-b-[3px] border-gray-800 py-2">
            <button
              type="button"
              aria-label="Expand sidebar"
              onClick={toggleCollapsed}
              className={`cursor-pointer border-2 border-gray-700 p-1 text-gray-300 transition-colors hover:border-paper hover:bg-gray-800 hover:text-paper ${DARK_FOCUS}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" className="h-4 w-4" aria-hidden="true"><path d="M10 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks(collapsed)}
        </nav>
        <div className="border-t-[3px] border-gray-800 px-3 py-4">{signOutButton(collapsed)}</div>
      </aside>

      {/* Main column: mobile top bar + desktop notifications bar + scroll area.
          The bars are in normal flow so they sit below any demo banner above
          the shell (no fixed-position overlap that would hide the hamburger). */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b-[3px] border-ink bg-paper px-4 md:hidden">
          {wordmark(false)}
          <div className="flex items-center gap-2">
            <span className="max-w-[90px] truncate text-xs font-semibold text-gray-600">{orgName}</span>
            {notifications}
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
        {/* Desktop notifications bar */}
        {notifications && (
          <div className="hidden shrink-0 items-center justify-end gap-3 border-b-[3px] border-ink bg-paper px-6 py-2.5 md:flex">
            {notifications}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
