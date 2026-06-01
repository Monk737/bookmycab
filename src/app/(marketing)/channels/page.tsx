import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { TransparencySection } from "@/components/marketing/transparency-section";

export const metadata: Metadata = {
  title: "Channels — CabbyBot",
  description:
    "One bespoke automation across WhatsApp, Telegram, Messenger, Instagram and an on-site AI chat widget. You connect your own numbers and own your customer base — nothing held hostage.",
};

// The five inbound channels — PRD §5.1, §5.2.
const CHANNELS = [
  {
    name: "WhatsApp Business",
    body: "Take bookings on the channel most of your customers already message you on — text and voice notes included.",
  },
  {
    name: "Telegram",
    body: "A fast, reliable bot conversation for customers who prefer Telegram for their rides.",
  },
  {
    name: "Messenger",
    body: "Turn Facebook Messenger enquiries into confirmed bookings without a human picking up.",
  },
  {
    name: "Instagram DM",
    body: "Catch the customers who slide into your DMs and book them straight into dispatch.",
  },
  {
    name: "On-site AI Chat widget",
    body: "An AI chat widget on your own website that quotes and books around the clock.",
  },
];

export default function ChannelsPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>Channels</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            One automation, every channel your customers use.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Your bespoke build answers everywhere at once — and every confirmed
            booking lands in the dispatch system you already run.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Channel grid */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((channel) => (
              <div key={channel.name} className="bg-paper p-7 sm:p-8">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {channel.name}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {channel.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Customer-owned credentials transparency */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-ink bg-accent px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-accent-ink sm:text-4xl">
              You own your channels. You own your customers.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              You connect your own numbers. You pay channel fees directly to
              Meta, Telegram or your telco. You own your customer base — nothing
              is ever held hostage.
            </p>
          </div>
        </Container>
      </Section>

      {/* External cost transparency — reuse §6.4 section */}
      <Section className="py-14 sm:py-20">
        <Container>
          <TransparencySection />
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-14 sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Books straight into your dispatch
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Whichever channel a booking comes in on, it lands directly in the
            dispatch system you already run.
          </p>
          <div className="mt-8">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Let&apos;s connect your channels.
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
