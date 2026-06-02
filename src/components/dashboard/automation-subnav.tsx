"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SubnavItem = { label: string; href: string };

function getSubnavItems(id: string): SubnavItem[] {
  return [
    { label: "Overview", href: `/dashboard/automations/${id}` },
    { label: "Bookings", href: `/dashboard/automations/${id}/bookings` },
    { label: "Conversations", href: `/dashboard/automations/${id}/conversations` },
    { label: "Analytics", href: `/dashboard/automations/${id}/analytics` },
    { label: "Config", href: `/dashboard/automations/${id}/config` },
    { label: "Channels", href: `/dashboard/automations/${id}/channels` },
  ];
}

/** True when `href` is the active subnav tab (exact for the root, prefix otherwise). */
function isActive(pathname: string, href: string, id: string): boolean {
  const root = `/dashboard/automations/${id}`;
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Per-automation tab bar. Renders tabs for all six automation sub-sections.
 * Active-route aware via usePathname.
 */
export function AutomationSubnav({
  automationId,
}: {
  automationId: string;
}): React.JSX.Element {
  const pathname = usePathname();
  const items = getSubnavItems(automationId);

  return (
    <nav
      aria-label="Automation sections"
      className="border-b border-slate-200 bg-white"
    >
      <div className="flex overflow-x-auto px-4 md:px-6" role="tablist">
        {items.map((item) => {
          const active = isActive(pathname, item.href, automationId);
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 cursor-pointer px-4 py-3 text-sm font-medium outline-none whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-inset ${
                active
                  ? "border-b-2 border-blue-800 text-blue-800"
                  : "border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
