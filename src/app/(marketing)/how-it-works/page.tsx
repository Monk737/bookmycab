import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { ChannelFlow } from "@/components/marketing/channel-flow";

export const metadata: Metadata = {
  title: "How It Works — BookMyCab",
  description:
    "From a customer's message to a dispatched cab, and from a discovery call to going live: how your bespoke automation reads bookings, even voice notes, and lands them in AutoCab, iCabbi or Cordic.",
};

// The customer journey — PRD §9.2 public framing, §5.1.
const STEPS = [
  {
    n: "01",
    title: "Book a discovery call",
    body: "We start with a conversation about your firm: your fleet, your channels, your busiest hours and where calls go unanswered today.",
  },
  {
    n: "02",
    title: "We scope and quote",
    body: "You get clear options, A, B or C, sized to your fleet and the booking flows you actually need. Transparent pricing, no surprises.",
  },
  {
    n: "03",
    title: "We build your bespoke automation",
    body: "Your automation is built around your own fares, vehicles and dispatch system. Bespoke per customer, never a template clone of someone else's bot.",
  },
  {
    n: "04",
    title: "Connect your channels",
    body: "We connect the channels your customers already use, WhatsApp, Telegram, Messenger, Instagram and an on-site chat widget, to your bespoke build.",
  },
  {
    n: "05",
    title: "Go live with 30-day hypercare",
    body: "We switch you on and stay close for 30 days, watching every run, tuning the experience and making sure each booking lands cleanly in your dispatch.",
  },
];

// Booking modes the automation handles end-to-end — PRD §5.1.
const BOOKING_MODES = [
  {
    title: "ASAP",
    body: "A customer needs a cab now. Your automation captures the pickup, destination and vehicle, quotes the fare and confirms, all in one conversation.",
  },
  {
    title: "Scheduled",
    body: "Booking ahead for later today or next week? The pickup time is captured up front and the journey is held against the right slot.",
  },
  {
    title: "Airport pickup",
    body: "Live flight tracking and terminal-aware routing handle airport runs: the right terminal, the right timing, even when a flight shifts.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Container className="max-w-3xl">
          <Badge>How it works</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl xl:text-7xl">
            From a message to a{" "}
            <span className="box-decoration-clone bg-accent px-2 text-accent-ink">
              dispatched cab
            </span>
            .
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            One conversation does the whole job. Below is exactly what happens
            between a customer&apos;s first message and a driver pulling up, and
            how we build it for your firm.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Signature — the runtime flow diagram. */}
      <Section className="pb-16 pt-4 sm:pb-24">
        <Container>
          <ChannelFlow />
        </Container>
      </Section>

      {/* Voice pipeline — art-directed dark band. */}
      <Section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-paper sm:text-5xl">
                Even a ten-second voice note{" "}
                <span className="box-decoration-clone bg-accent px-2 text-accent-ink">
                  gets booked
                </span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-300">
                Customers send a voice note from a noisy street as often as they
                type. Your automation transcribes it, pulls out the pickup,
                destination and time, and turns it into a confirmed booking
                without anyone at your desk lifting a finger.
              </p>
            </div>

            <div className="lg:pl-8">
              <ol className="space-y-px overflow-hidden rounded-2xl border border-gray-700">
                {[
                  { k: "Voice note in", v: "“Fourteen Mill Road to Stansted, half six tomorrow”" },
                  { k: "Transcribed", v: "Speech turned to text, accent and noise handled" },
                  { k: "Details pulled out", v: "Pickup, destination and time, ready to quote" },
                  { k: "Booked", v: "Fare quoted, confirmed, written to dispatch" },
                ].map((row, i) => (
                  <li
                    key={row.k}
                    className="flex gap-4 bg-gray-900 px-5 py-4"
                  >
                    <span className="font-display text-lg font-semibold tabular-nums text-gray-500">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-paper">{row.k}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-gray-400">
                        {row.v}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </Section>

      {/* Onboarding journey — clean numbered list. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              How we get you there
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              We don&apos;t hand you a generic bot. We scope your firm, quote it
              honestly, build around your fleet and dispatch, then stay close
              while you go live.
            </p>
          </div>

          <ol className="mt-12 divide-y divide-gray-200 border-t border-gray-200">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid gap-2 py-7 sm:grid-cols-[5rem_1fr] sm:gap-8"
              >
                <span className="font-display text-3xl font-semibold tabular-nums text-ink sm:text-4xl">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-600">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Booking modes — differentiated list. */}
      <Section className="bg-gray-50 py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Every booking mode, one conversation
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              ASAP rides, scheduled journeys and airport runs all happen in a
              single natural conversation with your customer.
            </p>
          </div>
          <dl className="mt-10 divide-y divide-gray-200 border-t border-gray-200">
            {BOOKING_MODES.map((mode) => (
              <div
                key={mode.title}
                className="grid gap-2 py-7 sm:grid-cols-[14rem_1fr] sm:gap-10"
              >
                <dt className="font-display text-xl font-semibold text-ink">
                  {mode.title}
                </dt>
                <dd className="max-w-2xl text-base leading-relaxed text-gray-600">
                  {mode.body}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      {/* Closing CTA band — homepage parity. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="rounded-3xl bg-ink px-7 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-5xl">
              Ready to see your bespoke build?
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-gray-300">
              Book a discovery call and we will map your channels, fares and
              dispatch into an automation built for your firm.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-full border border-gray-600 px-7 text-base font-medium tracking-tight text-paper transition-colors duration-200 hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                View pricing
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
