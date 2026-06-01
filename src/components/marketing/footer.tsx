import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { FOOTER_COLUMNS, LEGAL_NAV, COMPANY } from "@/lib/marketing/nav";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-paper">
      <Container className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-display text-xl font-semibold tracking-tight text-ink">
              {COMPANY.product}
              <span className="text-accent">.</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-gray-600">
              {COMPANY.tagline}
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-600 transition-colors duration-200 hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-12 max-w-md text-sm font-medium text-ink">
          {COMPANY.transparency}
        </p>

        <div className="mt-8 flex flex-col gap-4 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            © {year} {COMPANY.entity}. {COMPANY.country}.
          </p>
          <ul className="flex flex-wrap gap-5">
            {LEGAL_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-xs text-gray-500 transition-colors duration-200 hover:text-ink"
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
