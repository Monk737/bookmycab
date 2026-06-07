import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DemoWhatsAppCta } from "@/components/marketing/demo-whatsapp-cta";
import { Reveal } from "@/components/marketing/reveal";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "Contact · BookMyCab",
  description:
    "Talk to BookMyCab. Email contact@bookmycab.io or call +44 7908 913243, or book a discovery call and we'll scope your fleet, channels and dispatch. No signup, no sales funnel.",
};

// Primary, one-tap contact routes (no backend form; Resend wiring is later).
const PRIMARY = [
  {
    label: "Email us",
    value: "contact@bookmycab.io",
    href: "mailto:contact@bookmycab.io",
    hint: "We reply within one working day.",
    icon: <MailIcon />,
  },
  {
    label: "Call us",
    value: "+44 7908 913243",
    href: "tel:+447908913243",
    hint: "Speak to the team that builds it.",
    icon: <PhoneIcon />,
  },
];

const META = [
  { label: "Company", value: COMPANY.entity },
  { label: "Where we are", value: COMPANY.country },
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const demoUnavailable = demo === "unavailable";

  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl rise-group">
          {demoUnavailable && (
            <p
              role="status"
              className="mb-6 border-[3px] border-ink bg-brut-cyan px-4 py-3 text-sm font-bold text-ink shadow-brut-sm"
            >
              The live demo is between resets right now. Book a 20-minute
              walkthrough below and we&apos;ll drive the dashboard for you.
            </p>
          )}
          <Badge>Contact</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl">
            Let&apos;s talk about your build.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            The fastest way to start is a discovery call. We&apos;ll look at your
            fleet, the channels your customers use and the dispatch system you
            already run, then quote it honestly. No signup, no obligation.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
            <DemoWhatsAppCta />
          </div>
        </Container>
      </Section>

      {/* Primary contact routes, big tap targets. */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <div>
              <span className="inline-block bg-brut-yellow px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-ink">
                Reach us direct
              </span>
              <h2 className="mt-5 font-display text-3xl font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-4xl">
                Two ways to get a human.
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-gray-700">
                No tickets, no phone tree. The people who answer are the people
                who build and run your automation.
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-[3px] overflow-hidden border-[3px] border-ink bg-ink shadow-brut">
                {META.map((item) => (
                  <div key={item.label} className="bg-paper p-5">
                    <dt className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                      {item.label}
                    </dt>
                    <dd className="mt-2 font-display text-base font-extrabold uppercase tracking-tight text-ink">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <Reveal className="grid gap-4">
              {PRIMARY.map((route) => (
                <a
                  key={route.label}
                  href={route.href}
                  className="brut-hover-lift brut-focus group flex items-center gap-5 border-[3px] border-ink bg-paper p-6 shadow-brut sm:p-7"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center border-[3px] border-ink bg-brut-yellow text-ink transition-colors duration-200 group-hover:bg-brut-cyan"
                  >
                    {route.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                      {route.label}
                    </span>
                    <span className="mt-1 block break-words font-display text-xl font-extrabold tracking-tight text-ink underline-offset-4 group-hover:underline sm:text-2xl">
                      {route.value}
                    </span>
                    <span className="mt-1 block text-sm font-medium text-gray-600">
                      {route.hint}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto hidden shrink-0 text-2xl text-ink transition-transform duration-200 group-hover:translate-x-1 sm:block"
                  >
                    →
                  </span>
                </a>
              ))}
            </Reveal>
          </div>

          <p className="mt-8 max-w-2xl text-base leading-relaxed text-gray-600">
            We don&apos;t run a public signup. Every BookMyCab is
            admin-provisioned after a discovery call, so reach out and
            we&apos;ll set up a time that suits you.
          </p>
        </Container>
      </Section>

      {/* Transparency promise */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="border-[3px] border-ink bg-brut-yellow shadow-brut-xl px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-accent-ink sm:text-4xl">
              {COMPANY.transparency}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              We build it, you own it. Your numbers, your channels, your customer
              base, start with a conversation and see exactly how it would work
              for your firm.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}

function MailIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="1" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}
