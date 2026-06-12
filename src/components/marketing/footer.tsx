import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/marketing/ui/container";
import { FOOTER_COLUMNS, LEGAL_NAV, COMPANY } from "@/lib/marketing/nav";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-[3px] border-ink bg-ink text-paper">
      <Container className="py-16">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-1">
            {/* Footer brand logo — light wordmark, sits directly on the ink footer. */}
            <Image
              src="/footer-logo.png"
              alt="BookMyCab"
              width={800}
              height={339}
              className="h-auto w-44 sm:w-52"
            />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-gray-300">
              {COMPANY.tagline}
            </p>
          </div>

          {/* Link columns: 2-up on mobile, 3-up on tablet, in a row on desktop. */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3 lg:gap-10">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading}>
              <h4 className="inline-block bg-brut-yellow px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="brut-focus text-sm font-medium text-gray-300 underline-offset-4 transition-colors duration-150 hover:text-brut-yellow hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t-2 border-gray-700 pt-6 sm:flex-row sm:justify-between">
          <p className="order-2 text-xs font-medium text-gray-400 sm:order-1">
            © {year} {COMPANY.entity}. {COMPANY.country}.
          </p>

          {/* Crafted in the UK, bottom centre. */}
          <p className="order-1 inline-flex items-center gap-2 border-2 border-paper bg-gray-900 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-paper sm:order-2">
            <span aria-hidden="true" className="text-base leading-none">🇬🇧</span>
            Crafted in the UK for the world
          </p>

          <ul className="order-3 flex flex-wrap justify-center gap-4">
            {LEGAL_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="brut-focus text-xs font-medium uppercase tracking-[0.04em] text-gray-400 transition-colors duration-150 hover:text-brut-yellow"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
