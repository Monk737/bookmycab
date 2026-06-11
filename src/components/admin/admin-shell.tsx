"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { label: string; href: string; icon: ReactNode };
type NavGroup = { title: string; items: NavItem[] };

/* Square-cap line icons, matching the brutalist stroke of the tenant shell. */
const ico = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" strokeLinejoin="miter" className="h-[17px] w-[17px] shrink-0" aria-hidden="true">
    {path}
  </svg>
);

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operate",
    items: [
      { label: "Overview", href: "/admin", icon: ico(<><path d="M4 13h7V4H4zM13 20h7v-9h-7zM13 4v3h7V4zM4 17v3h7v-3z" /></>) },
      { label: "Health", href: "/admin/health", icon: ico(<path d="M3 12h4l2 6 4-14 2 8h6" />) },
      { label: "Usage", href: "/admin/usage", icon: ico(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>) },
    ],
  },
  {
    title: "Tenants & Build",
    items: [
      { label: "Tenants", href: "/admin/tenants", icon: ico(<><path d="M3 21V8l7-4 7 4v13" /><path d="M3 21h18M9 21v-5h4v5" /></>) },
      { label: "Build Queue", href: "/admin/build-queue", icon: ico(<><path d="M4 5h16M4 12h16M4 19h10" /></>) },
      { label: "Channel review", href: "/admin/channel-review", icon: ico(<><path d="M4 4h16v11H8l-4 4z" /><path d="m9 9 2 2 4-4" /></>) },
      { label: "Automations", href: "/admin/automations", icon: ico(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="M8 8h8v8H8z" /></>) },
      { label: "Credentials", href: "/admin/credentials", icon: ico(<><circle cx="8" cy="12" r="3" /><path d="M11 12h10M17 12v4M21 12v3" /></>) },
    ],
  },
  {
    title: "Commerce",
    items: [
      { label: "Billing", href: "/admin/billing", icon: ico(<><path d="M3 6h18v12H3z" /><path d="M3 10h18" /></>) },
      { label: "Plans", href: "/admin/plans", icon: ico(<><path d="M4 6h16v14H4z" /><path d="M8 3v6M16 3v6M4 12h16" /></>) },
      { label: "Coupons", href: "/admin/coupons", icon: ico(<><path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4z" /><path d="M14 6v12" /></>) },
    ],
  },
  {
    title: "Controls",
    items: [
      { label: "Platform", href: "/admin/platform", icon: ico(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>) },
      { label: "Benchmarks", href: "/admin/benchmarks", icon: ico(<><path d="M12 14a4 4 0 100-8M12 6V2M5 21l4-5M19 21l-4-5" /></>) },
      { label: "Guardrails", href: "/admin/guardrails", icon: ico(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />) },
      { label: "Rollouts", href: "/admin/rollouts", icon: ico(<><path d="M4 4v16M4 6h13l-2 3 2 3H4" /></>) },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "Impersonate", href: "/admin/impersonate", icon: ico(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>) },
    ],
  },
];

/** True when `href` is the active route (exact for /admin, prefix otherwise). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const DARK_FOCUS =
  "outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Internal operational console shell. Persistent left brutalist ink sidebar with
 * a CYAN active block, the staff surface accent, deliberately distinct from the
 * tenant dashboard (yellow) and demo (pink). Nav grouped by job: Operate,
 * Tenants & Build, Commerce, Controls, Support. Staff-only.
 */
export function AdminShell({
  children,
  banner,
}: {
  children: ReactNode;
  banner?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="flex w-60 shrink-0 flex-col border-r-[3px] border-ink bg-ink text-gray-300 print:hidden">
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
          <div className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">{group.title}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 border-2 px-3 py-2 text-sm font-bold uppercase tracking-[0.04em] transition-colors duration-150 ${DARK_FOCUS} ${
                            active
                              ? "border-ink bg-brut-cyan text-ink shadow-brut-sm"
                              : "border-transparent text-gray-400 hover:bg-gray-800 hover:text-paper"
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
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
