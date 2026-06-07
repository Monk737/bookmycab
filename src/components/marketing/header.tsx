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
      className="brut-focus inline-flex shrink-0 items-center font-logo text-xl leading-none tracking-tight text-ink"
      aria-label={`${COMPANY.product} home`}
    >
      {COMPANY.product}
      <span aria-hidden="true" className="ml-1 inline-block h-3.5 w-3.5 border-2 border-ink bg-brut-yellow" />
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-ink bg-paper">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />

        {/* Desktop nav, single line, even spacing, appears at xl where 7 items fit. */}
        <nav className="hidden min-w-0 items-center xl:flex" aria-label="Main">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="brut-focus whitespace-nowrap px-2.5 py-2 text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition-colors duration-150 hover:bg-brut-yellow"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center xl:flex">
          <DiscoveryCta label="Book a Call" />
        </div>

        {/* Mobile / tablet trigger, everything below xl. */}
        <button
          type="button"
          className="brut-focus inline-flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-ink bg-paper text-ink shadow-brut-sm xl:hidden"
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
            strokeWidth="2.5"
            strokeLinecap="square"
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
        <div className="border-t-[3px] border-ink bg-paper xl:hidden">
          <Container className="flex flex-col gap-1 py-4">
            <Link
              href="/"
              className="brut-focus border-2 border-transparent px-3 py-2.5 text-base font-bold uppercase tracking-[0.03em] text-ink transition-colors duration-150 hover:border-ink hover:bg-brut-yellow"
              onClick={() => setOpen(false)}
            >
              Home
            </Link>
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="brut-focus border-2 border-transparent px-3 py-2.5 text-base font-bold uppercase tracking-[0.03em] text-ink transition-colors duration-150 hover:border-ink hover:bg-brut-yellow"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3">
              <DiscoveryCta size="lg" className="w-full" />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
