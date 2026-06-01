import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { TransparencySection } from "@/components/marketing/transparency-section";

export const metadata: Metadata = {
  title: "Pricing — CabbyBot",
  description:
    "Simple, transparent pricing for your bespoke cab automation. Fixed monthly options by fleet size, a one-time setup fee, and a clear breakdown of what you pay your own providers.",
};

// §6.3 — add-on automations quoted on demand.
const ADD_ONS = [
  {
    name: "Support Bot",
    body: "An automation that answers customer questions and triages issues alongside your booking flow.",
  },
  {
    name: "Driver Solution",
    body: "A driver-facing automation for job updates, availability and shift logistics.",
  },
  {
    name: "Custom automations",
    body: "Anything bespoke to your firm — built around your fleet and dispatch, quoted on demand.",
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>Pricing</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Simple, transparent pricing.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Pick the option that fits your fleet. One fixed monthly price, one
            setup fee, and no hidden margins on the channels you already use.
          </p>
        </Container>
      </Section>

      {/* Cards + currency toggle + setup fee + contract */}
      <Section className="py-10 sm:py-14">
        <Container>
          <PricingCards />
        </Container>
      </Section>

      {/* Add-ons */}
      <Section className="py-10 sm:py-14">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Add-on automations
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Extend your booking automation with extra solutions, quoted on
            demand around your needs.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {ADD_ONS.map((addOn) => (
              <div key={addOn.name} className="bg-paper p-7 sm:p-8">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {addOn.name}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {addOn.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Cost transparency */}
      <Section className="py-10 sm:py-14">
        <Container>
          <TransparencySection />
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-10 sm:py-14">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Integrated with AutoCab · iCabbi · Cordic
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Confirmed bookings land straight in the dispatch system you already
            run.
          </p>
          <div className="mt-8">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* Closing CTA */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              See exactly what your automation would cost.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
              Book a discovery call and we&apos;ll scope your fleet, channels and
              dispatch into a clear quote.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
