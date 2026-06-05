import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "About — BookMyCab",
  description:
    "BookMyCab is built by FlowMo AI LTD, made in the United Kingdom. We build bespoke omnichannel booking automations for cab firms — confident, technical, transparent, no hype. You bring your numbers. You own your customer base.",
};

// §3 — what we believe / how we work. Plain principles, no hype.
const PRINCIPLES = [
  {
    title: "Bespoke, never a template clone",
    body: "Every firm gets an automation built around its own fares, vehicles and dispatch. No two builds are the same, because no two firms are.",
  },
  {
    title: "Transparent by default",
    body: "Clear options, honest quotes and no hidden margins. Channel and AI usage is billed by your own providers, at cost.",
  },
  {
    title: "You stay in control",
    body: "You connect your own numbers and bring your own keys. We build the automation; you keep the relationship with your customers.",
  },
  {
    title: "We stay close",
    body: "We don't switch you on and disappear. Thirty days of hypercare at go-live, watching every booking land cleanly in your dispatch.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>About</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Built for cab firms, by {COMPANY.entity}.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            {COMPANY.product} is a bespoke omnichannel booking automation for cab
            and taxi companies. We build it around your fleet and your dispatch —
            never a template clone of someone else&apos;s bot.
          </p>
          <p className="mt-4 text-base font-medium text-ink">
            Made in the {COMPANY.country} 🇬🇧
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Positioning */}
      <Section className="py-14 sm:py-20">
        <Container className="max-w-3xl">
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Confident and technical, without the hype.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            We&apos;re engineers who&apos;d rather show you a clean booking land in
            your dispatch than sell you a buzzword. Every claim we make is one
            we&apos;ll stand behind on a discovery call — and one you can see for
            yourself in the live dashboard.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            {COMPANY.tagline}
          </p>
        </Container>
      </Section>

      {/* Principles */}
      <Section className="py-14 sm:py-20">
        <Container>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            How we work
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="bg-paper p-7 sm:p-9">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {principle.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {principle.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Transparency promise */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-ink bg-accent px-7 py-12 sm:px-12 sm:py-16">
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-accent-ink/70">
              Our transparency promise
            </p>
            <h2 className="mt-4 text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-accent-ink sm:text-4xl">
              You bring your numbers. You own your customer base. We never hold
              you hostage.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              Your channels, your keys, your customers — all yours. We build the
              automation that works for you, and we earn our place by being worth
              keeping, not by locking you in.
            </p>
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Let&apos;s talk about your firm.
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              <TryDashboardLink size="lg" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
