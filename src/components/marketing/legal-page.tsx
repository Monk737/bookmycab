import type { ReactNode } from "react";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { COMPANY } from "@/lib/marketing/nav";

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

type LegalPageProps = {
  title: string;
  /** ISO date string, rendered as "Last updated". */
  lastUpdated: string;
  intro: ReactNode;
  sections: LegalSection[];
};

/**
 * Shared layout for the public legal pages (Privacy/Terms/DPA/Cookies). These are
 * the finalized customer-facing summaries; the binding, signed documents are still
 * issued with each contract at provisioning (stated in the notice below).
 */
export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  const formatted = new Date(lastUpdated).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Section className="pb-14 sm:pb-20">
      <Container className="max-w-3xl">
        <Badge>Legal</Badge>
        <h1 className="mt-6 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
          Last updated {formatted}
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5">
          <p className="text-base leading-relaxed text-gray-600">
            This is a summary of how we intend to operate. Your binding terms are
            issued with your contract when your bespoke build is provisioned —
            those documents prevail over anything on this page.
          </p>
        </div>

        <p className="mt-8 text-lg leading-relaxed text-gray-600">{intro}</p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
                {section.heading}
              </h2>
              <div className="mt-3 text-base leading-relaxed text-gray-600">
                {section.body}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t border-gray-200 pt-8 text-sm leading-relaxed text-gray-500">
          {COMPANY.entity}, {COMPANY.country}. Questions about this policy?
          Email{" "}
          <a className="text-ink underline underline-offset-4" href="mailto:hello@bookmycab.com">
            hello@bookmycab.com
          </a>
          .
        </p>
      </Container>
    </Section>
  );
}
