import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { TransparencySection } from "@/components/marketing/transparency-section";
import { ChannelConvergence } from "@/components/marketing/channel-convergence";

export const metadata: Metadata = {
  title: "Channels — BookMyCab",
  description:
    "One bespoke automation across WhatsApp, Telegram, Messenger, Instagram and an on-site AI chat widget. You connect your own numbers and own your customer base — nothing held hostage.",
};

// The five inbound channels — PRD §5.1, §5.2.
const CHANNELS = [
  {
    name: "WhatsApp Business",
    body: "The channel most of your customers already message you on. Text and voice notes both become bookings, and a voice note from a noisy street is handled like any other.",
  },
  {
    name: "Telegram",
    body: "A fast, reliable bot conversation for the customers who prefer Telegram for their rides.",
  },
  {
    name: "Messenger",
    body: "Facebook Messenger enquiries turn into confirmed bookings without anyone at your desk picking up.",
  },
  {
    name: "Instagram DM",
    body: "Catch the customers who slide into your DMs and book them straight into dispatch, in the same place they messaged.",
  },
  {
    name: "On-site AI chat widget",
    body: "A chat widget on your own website that quotes and books around the clock, embedded where your customers already look for you.",
  },
];

export default function ChannelsPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Container className="max-w-3xl">
          <Badge>Channels</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl xl:text-7xl">
            One automation,{" "}
            <span className="box-decoration-clone bg-accent px-2 text-accent-ink">
              every channel
            </span>{" "}
            your customers use.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Your bespoke build answers everywhere at once, and every confirmed
            booking lands in the dispatch system you already run.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Signature — convergence visual. */}
      <Section className="pb-16 pt-4 sm:pb-24">
        <Container>
          <ChannelConvergence />
        </Container>
      </Section>

      {/* Per-channel detail — differentiated list, not an identical grid. */}
      <Section className="border-t border-gray-100 py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              What each channel does for you
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Same automation, same dispatch, met wherever the customer already
              is.
            </p>
          </div>
          <dl className="mt-10 divide-y divide-gray-200 border-t border-gray-200">
            {CHANNELS.map((channel) => (
              <div
                key={channel.name}
                className="grid gap-2 py-7 sm:grid-cols-[16rem_1fr] sm:gap-10"
              >
                <dt className="font-display text-xl font-semibold text-ink">
                  {channel.name}
                </dt>
                <dd className="max-w-2xl text-base leading-relaxed text-gray-600">
                  {channel.body}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      {/* Customer-owned credentials — committed amber band. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="rounded-3xl border border-ink bg-accent px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-accent-ink sm:text-4xl">
              You own your channels. You own your customers.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              You connect your own numbers. You pay channel fees directly to
              Meta, Telegram or your telco. You own your customer base, and
              nothing is ever held hostage.
            </p>
          </div>
        </Container>
      </Section>

      {/* External cost transparency — reuse §6.4 section. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <TransparencySection />
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Books straight into your dispatch
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Whichever channel a booking comes in on, it lands directly in the
              dispatch system you already run.
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
              Let&apos;s connect your channels
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-gray-300">
              Book a discovery call and we will wire up every channel your
              customers use into one automation.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              <Link
                href="/how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-full border border-gray-600 px-7 text-base font-medium tracking-tight text-paper transition-colors duration-200 hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                See how it works
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
