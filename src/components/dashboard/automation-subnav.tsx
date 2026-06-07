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
      className="border-b-[3px] border-ink bg-paper"
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
              className={`relative -mb-[3px] shrink-0 cursor-pointer border-b-[5px] px-4 py-3 text-sm font-bold uppercase tracking-[0.03em] outline-none whitespace-nowrap transition-colors duration-150 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-ink ${
                active
                  ? "border-ink bg-brut-yellow text-ink"
                  : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-ink"
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
