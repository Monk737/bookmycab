import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { PricingSections } from "@/components/marketing/pricing-sections";
import { PricingRoi } from "@/components/marketing/pricing-roi";
import { TransparencySection } from "@/components/marketing/transparency-section";
import { Reveal } from "@/components/marketing/reveal";
import { getFxRates } from "@/lib/marketing/fx";

export const metadata: Metadata = {
  title: "Pricing · BookMyCab",
  description:
    "Transparent pricing for BookMyCab. A multi-channel Chat bot and an AI Voice agent — buy either, or bundle both as a Double Decker. Fixed monthly plans by fleet size and call volume, one-time setup, and pay-as-you-go voice credit at £0.90 per call.",
};

// §6.3, add-on automations quoted on demand.
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
    body: "Anything specific to your firm, built around your fleet and dispatch and quoted on demand.",
  },
];

export default async function PricingPage() {
  const rates = await getFxRates();
  return (
    <>
      {/* Hero */}
      <Section className="pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Container className="max-w-3xl rise-group">
          <Badge>Pricing</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl xl:text-7xl">
            One fixed price.{" "}
            <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
              No hidden margins.
            </span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Two products, one bill. A multi-channel Chat bot and an AI Voice
            agent — buy either on its own, or bundle both as a Double Decker.
            You pay BookMyCab one monthly price and one setup fee; your channel
            and dispatch providers you pay directly, at their cost.
          </p>
        </Container>
      </Section>

      {/* Advanced ROI calculator, the proof before the price. */}
      <Section className="pb-12 pt-2 sm:pb-16">
        <Container>
          <div className="mb-6 max-w-2xl">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-3xl">
              See the price pay for itself
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-700">
              Slide in your own numbers. This is the revenue an always-on bot
              puts back, set against what the plan costs.
            </p>
          </div>
          <PricingRoi rates={rates} />
        </Container>
      </Section>

      {/* Three product sections + currency toggle + setup fees + credit */}
      <Section className="py-10 sm:py-14">
        <Container>
          <PricingSections rates={rates} />
        </Container>
      </Section>

      {/* Add-ons, differentiated list, not an identical card grid. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Add another automation when you need it
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Your booking automation is the core. Extend it with extra
              automations, each scoped and quoted around your firm.
            </p>
          </div>
          <Reveal as="dl" className="mt-10 divide-y-2 divide-ink border-t-[3px] border-ink">
            {ADD_ONS.map((addOn) => (
              <div
                key={addOn.name}
                className="grid gap-2 py-7 sm:grid-cols-[14rem_1fr] sm:gap-10"
              >
                <dt className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">
                  {addOn.name}
                </dt>
                <dd className="max-w-2xl text-base leading-relaxed text-gray-600">
                  {addOn.body}
                </dd>
              </div>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Cost transparency, art-directed ink-dark band. */}
      <Section className="bg-ink py-20 sm:py-28">
        <Container>
          <TransparencySection tone="dark" />
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
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

      {/* Closing CTA band, homepage parity. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="border-[3px] border-ink bg-ink px-7 py-16 text-center shadow-brut-xl sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-paper sm:text-5xl">
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
