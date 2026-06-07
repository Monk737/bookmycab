import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/marketing/ui/container";
import { FOOTER_COLUMNS, LEGAL_NAV, COMPANY } from "@/lib/marketing/nav";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-[3px] border-ink bg-ink text-paper">
      <Container className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="inline-flex items-center font-logo text-base leading-none tracking-tight text-paper">
              {COMPANY.product}
              <span aria-hidden="true" className="ml-1 inline-block h-3 w-3 border-2 border-paper bg-brut-yellow" />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-300">
              {COMPANY.tagline}
            </p>
            {/* Brand mark, transparent PNG on the dark footer, no card.
                Sized to roughly match the header nav logo height. */}
            <Image
              src="/BMC-Cab.png"
              alt="BookMyCab"
              width={252}
              height={107}
              className="mt-6 h-10 w-auto"
            />
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="inline-block bg-brut-yellow px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) =>
                  item.href === "/demo" ? (
                    // Demo dashboard not live yet — non-clickable + Coming soon tag.
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title="Coming soon"
                        className="inline-flex cursor-not-allowed items-center gap-2 text-sm font-medium text-gray-500"
                      >
                        {item.label}
                        <span className="border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-gray-300">
                          Coming soon
                        </span>
                      </span>
                    </li>
                  ) : (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="brut-focus text-sm font-medium text-gray-300 underline-offset-4 transition-colors duration-150 hover:text-brut-yellow hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
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
