"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Tenants", href: "/admin/tenants" },
  { label: "Plans", href: "/admin/plans" },
  { label: "Automations", href: "/admin/automations" },
  { label: "Build Queue", href: "/admin/build-queue" },
  { label: "Credentials", href: "/admin/credentials" },
  { label: "Billing", href: "/admin/billing" },
  { label: "Impersonate", href: "/admin/impersonate" },
];

/** True when `href` is the active route (exact for /admin, prefix otherwise). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Internal operational console shell. Persistent left sidebar, dense neutral
 * (zinc) palette, monospaced wordmark — deliberately distinct from the
 * marketing (#FFD400) and product-auth (indigo/slate) surfaces. Staff-only.
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
    <div className="flex min-h-screen bg-zinc-100 text-zinc-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-300">
        <div className="border-b border-zinc-800 px-5 py-5">
          <p className="font-mono text-sm font-semibold tracking-tight text-white">
            CabbyBot
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-emerald-400">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            />
            FlowMo Staff
          </span>
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                      active
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-zinc-800 px-3 py-4">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-400 outline-none transition-colors duration-150 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
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
