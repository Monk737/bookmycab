import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { TransparencySection } from "@/components/marketing/transparency-section";

export const metadata: Metadata = {
  title: "Pricing — BookMyCab",
  description:
    "Simple, transparent pricing for your bespoke cab automation. Fixed monthly options by fleet size, a one-time setup fee, and a clear breakdown of what you pay your own providers.",
};

// §6.3 — add-on automations quoted on demand.
const ADD_ONS = [
  {
    name: "Support Bot",
    body: "Answers customer questions and triages issues alongside your booking flow, so the same thread handles a fare quote and a lost-property query.",
  },
  {
    name: "Driver Solution",
    body: "A driver-facing automation for job updates, availability and shift logistics, kept separate from the customer-facing booking line.",
  },
  {
    name: "Custom automations",
    body: "Anything bespoke to your firm, built around your fleet and dispatch and quoted on demand.",
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Container className="max-w-3xl">
          <Badge>Pricing</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl xl:text-7xl">
            One fixed price.{" "}
            <span className="box-decoration-clone bg-accent px-2 text-accent-ink">
              No hidden margins.
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Pick the option that fits your fleet. You pay one monthly price and
            one setup fee to BookMyCab, and your channel and dispatch providers
            directly, at their cost. Nothing in between.
          </p>
        </Container>
      </Section>

      {/* Cards + currency toggle + setup fee + contract + first-year anchor */}
      <Section className="py-10 sm:py-14">
        <Container>
          <PricingCards />
        </Container>
      </Section>

      {/* Add-ons — differentiated list, not an identical card grid. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Add another automation when you need it
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Your booking automation is the core. Extend it with extra
              automations, each scoped and quoted around your firm.
            </p>
          </div>
          <dl className="mt-10 divide-y divide-gray-200 border-t border-gray-200">
            {ADD_ONS.map((addOn) => (
              <div
                key={addOn.name}
                className="grid gap-2 py-7 sm:grid-cols-[14rem_1fr] sm:gap-10"
              >
                <dt className="font-display text-xl font-semibold text-ink">
                  {addOn.name}
                </dt>
                <dd className="max-w-2xl text-base leading-relaxed text-gray-600">
                  {addOn.body}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      {/* Cost transparency — art-directed ink-dark band. */}
      <Section className="bg-ink py-20 sm:py-28">
        <Container>
          <TransparencySection tone="dark" />
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Integrated with AutoCab, iCabbi and Cordic
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Confirmed bookings land straight in the dispatch system you already
              run, at no extra charge from us.
            </p>
          </div>
          <div className="mt-8">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* Closing CTA band — homepage parity. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="rounded-3xl bg-ink px-7 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-5xl">
              See exactly what your automation would cost
            </h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-gray-300">
              Book a discovery call and we will scope your fleet, channels and
              dispatch into one clear quote.
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
