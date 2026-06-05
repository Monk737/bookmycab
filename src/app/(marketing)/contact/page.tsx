import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DemoWhatsAppCta } from "@/components/marketing/demo-whatsapp-cta";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "Contact — BookMyCab",
  description:
    "Book a discovery call and we'll scope your fleet, channels and dispatch. No signup, no sales funnel — just a conversation about the bespoke build for your firm.",
};

// Direct contact routes — no backend form (Resend wiring is a later epic).
const DETAILS = [
  {
    label: "Email",
    value: "hello@bookmycab.com",
    href: "mailto:hello@bookmycab.com",
  },
  {
    label: "Company",
    value: COMPANY.entity,
  },
  {
    label: "Where we are",
    value: COMPANY.country,
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>Contact</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Let&apos;s talk about your bespoke build.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            The fastest way to start is a discovery call. We&apos;ll look at your
            fleet, the channels your customers use and the dispatch system you
            already run — then quote it honestly. No signup, no obligation.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
            <DemoWhatsAppCta />
          </div>
        </Container>
      </Section>

      {/* Contact details */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {DETAILS.map((item) => (
              <div key={item.label} className="bg-paper p-7 sm:p-8">
                <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
                  {item.label}
                </p>
                <p className="mt-3 font-display text-xl font-semibold text-ink">
                  {item.href ? (
                    <a
                      className="underline underline-offset-4 hover:text-gray-600"
                      href={item.href}
                    >
                      {item.value}
                    </a>
                  ) : (
                    item.value
                  )}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-600">
            Prefer email? Drop us a line and we&apos;ll get back to you to set up a
            time. We don&apos;t run a public signup — every BookMyCab is
            admin-provisioned after a discovery call.
          </p>
        </Container>
      </Section>

      {/* Transparency promise */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-ink bg-accent px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-accent-ink sm:text-4xl">
              {COMPANY.transparency}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              We build it, you own it. Your numbers, your channels, your customer
              base — start with a conversation and see exactly how it would work
              for your firm.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
