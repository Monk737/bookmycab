import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { Button } from "@/components/marketing/ui/button";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "BookMyCab — Your cab company, on every channel, on autopilot",
  description:
    "Bespoke AI booking and support automations for the global taxi industry. BookMyCab answers every channel, takes bookings around the clock, and books straight into your dispatch system.",
};

// Core value propositions — PRD §5.1.
const VALUE_PROPS = [
  {
    title: "Bespoke, never templated",
    body: "Every cab company gets an automation built around its own fleet, fares and dispatch system — not a clone of someone else's bot.",
  },
  {
    title: "Voice notes, understood",
    body: "Customers can send a voice note. Your automation transcribes it, picks out the pickup, destination and time, and books it.",
  },
  {
    title: "Every booking mode",
    body: "ASAP rides, scheduled journeys and airport runs with flight lookups — all handled in one conversation, on autopilot.",
  },
];

// Inbound channels — names only (PRD §5.1).
const CHANNELS = [
  "WhatsApp",
  "Telegram",
  "Messenger",
  "Instagram",
  "On-site Chat widget",
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-12 sm:pb-16">
        <Container className="max-w-4xl">
          <Badge>{COMPANY.product}</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-7xl">
            Your cab company.{" "}
            <span className="bg-accent px-2 text-accent-ink">
              On every channel.
            </span>{" "}
            On autopilot.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Bespoke AI booking &amp; support automations for the global taxi
            industry.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Value props */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {VALUE_PROPS.map((prop) => (
              <div key={prop.title} className="bg-paper p-7 sm:p-8">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {prop.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {prop.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Channels strip */}
      <Section className="py-14 sm:py-20">
        <Container>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            One automation, every channel
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {CHANNELS.map((channel) => (
              <span
                key={channel}
                className="rounded-full border border-gray-200 bg-paper px-5 py-2.5 font-display text-lg font-semibold text-ink"
              >
                {channel}
              </span>
            ))}
          </div>
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-14 sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Books straight into your dispatch
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Confirmed bookings land directly in the dispatch system you already
            run — no double-entry, no copy-paste.
          </p>
          <div className="mt-8">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* ROI calculator */}
      <Section className="py-14 sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            How much revenue are you missing?
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Every unanswered call or message is a fare lost to the firm down the
            road. See what an always-on automation recovers.
          </p>
          <div className="mt-8">
            <RoiCalculator />
          </div>
        </Container>
      </Section>

      {/* Transparency teaser */}
      <Section className="py-14 sm:py-20">
        <Container className="max-w-3xl text-center">
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            {COMPANY.transparency}
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button href="/channels" variant="secondary" size="lg">
              See the channels
            </Button>
            <Button href="/pricing" variant="ghost" size="lg">
              View pricing
            </Button>
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              {COMPANY.tagline}
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
