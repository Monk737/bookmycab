"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { MAIN_NAV, COMPANY } from "@/lib/marketing/nav";

function Wordmark() {
  return (
    <Link
      href="/"
      className="font-display text-xl font-semibold tracking-tight text-ink"
      aria-label={`${COMPANY.product} home`}
    >
      {COMPANY.product}
      <span className="text-accent">.</span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-paper/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Wordmark />

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-gray-600 transition-colors duration-200 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="text-sm text-gray-500 transition-colors duration-200 hover:text-ink"
          >
            Dashboard
          </Link>
          <DiscoveryCta />
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </Container>

      {open && (
        <div className="border-t border-gray-100 bg-paper lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-base text-gray-700 transition-colors duration-200 hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-md px-2 py-2 text-base text-gray-500 transition-colors duration-200 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <div className="px-2 pt-3">
              <DiscoveryCta size="lg" className="w-full" />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
