import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { Button } from "@/components/marketing/ui/button";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { BookingConversation } from "@/components/marketing/booking-conversation";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "BookMyCab — Your cab company, on every channel, on autopilot",
  description:
    "Bespoke AI booking and support automations for the global taxi industry. BookMyCab answers every channel, takes bookings around the clock, and books straight into your dispatch system.",
};

// The real ordered flow — message in, booked, dispatched. A genuine sequence,
// so the numbered markers carry information rather than decorate.
const STEPS = [
  {
    n: "01",
    title: "A message lands",
    body: "On WhatsApp, Telegram, Messenger, Instagram or your website. At two in the afternoon or two in the morning, every one gets answered.",
  },
  {
    n: "02",
    title: "Your automation books it",
    body: "It reads what the customer wants, even from a rambling voice note, quotes the fare, picks the vehicle and confirms the trip in the conversation.",
  },
  {
    n: "03",
    title: "It hits your dispatch",
    body: "The confirmed job lands in AutoCab, iCabbi or Cordic. Your drivers and controllers work exactly the way they do today.",
  },
];

// Inbound channels — names only (PRD §5.1).
const CHANNELS = [
  "WhatsApp",
  "Telegram",
  "Messenger",
  "Instagram",
  "Web chat widget",
];

export default function Home() {
  return (
    <>
      {/* Hero — split: editorial headline + live booking conversation. */}
      <Section className="pt-12 pb-16 sm:pt-16 sm:pb-20">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16">
            <div>
              <Badge>For taxi &amp; private-hire firms</Badge>
              <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl xl:text-7xl">
                Your cab company.{" "}
                <span className="box-decoration-clone bg-accent px-2 text-accent-ink">
                  On every channel.
                </span>{" "}
                On autopilot.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl">
                Bespoke AI booking and support automations for the taxi trade.
                Every channel answered, every booking taken around the clock,
                straight into the dispatch system you already run.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <DiscoveryCta size="lg" />
                <TryDashboardLink size="lg" />
              </div>
              <p className="mt-6 text-sm text-gray-500">
                Built per company, never a template. Provisioned by our team.
              </p>
            </div>

            <div className="lg:pl-4">
              <BookingConversation />
            </div>
          </div>
        </Container>
      </Section>

      {/* How it works — real 3-step sequence. */}
      <Section className="border-t border-gray-100 py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              From a customer&apos;s message to a dispatched cab
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              One conversation does the whole job. Here is what happens between
              the first message and a driver pulling up.
            </p>
          </div>

          <ol className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.n} className="relative">
                <div className="flex items-center gap-4">
                  <span className="font-display text-2xl font-semibold tabular-nums text-ink">
                    {step.n}
                  </span>
                  <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {step.body}
                </p>
                {i === STEPS.length - 1 && (
                  <span className="sr-only">Last step.</span>
                )}
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Voice + channels — art-directed dark band for contrast. */}
      <Section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-paper sm:text-5xl">
                A voice note is{" "}
                <span className="box-decoration-clone bg-accent px-2 text-accent-ink">
                  still a booking
                </span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-300">
                Customers ramble. They send half-sentences from a noisy street
                or fire over a ten-second voice note. Your automation transcribes
                it, pulls out the pickup, destination and time, and books it. No
                app to download, no form to fill.
              </p>
              <p className="mt-5 text-lg leading-relaxed text-gray-300">
                ASAP rides, scheduled journeys and airport runs with flight
                lookups all happen in the same thread the customer already uses.
              </p>
            </div>

            <div className="lg:pl-8">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-gray-400">
                One automation, every channel
              </p>
              <ul className="mt-6 flex flex-wrap gap-3">
                {CHANNELS.map((channel) => (
                  <li
                    key={channel}
                    className="rounded-full border border-gray-700 bg-gray-900 px-5 py-2.5 font-display text-lg font-semibold text-paper"
                  >
                    {channel}
                  </li>
                ))}
              </ul>
              <p className="mt-8 max-w-md leading-relaxed text-gray-400">
                One bound automation handles them all, so a customer who messages
                on Instagram today and WhatsApp next week is the same customer to
                you, not two conversations to juggle.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Dispatch integrations. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Books straight into your dispatch
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Confirmed bookings land directly in the dispatch system you already
              run. Nothing to re-key, nothing to reconcile at the end of the
              shift.
            </p>
          </div>
          <div className="mt-10">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* Missed fares + ROI calculator. */}
      <Section className="border-t border-gray-100 py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Every missed call is a fare for the firm down the road
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              When your line is engaged or it is the middle of the night, the
              customer does not wait. They book elsewhere. See what an always-on
              automation puts back on the meter.
            </p>
          </div>
          <div className="mt-10">
            <RoiCalculator />
          </div>
        </Container>
      </Section>

      {/* Transparency. */}
      <Section className="py-16 sm:py-24">
        <Container className="max-w-3xl text-center">
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            {COMPANY.transparency}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
            Your bookings, your customers and your numbers stay yours. We build
            and run the automation; the business it brings in belongs to you.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/how-it-works" variant="secondary" size="lg">
              See how it works
            </Button>
            <Button href="/pricing" variant="ghost" size="lg">
              View pricing
            </Button>
          </div>
        </Container>
      </Section>

      {/* Closing CTA band. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="rounded-3xl bg-ink px-7 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-5xl">
              {COMPANY.tagline}
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-gray-300">
              Book a 20-minute discovery call and we will map your channels,
              fares and dispatch into an automation built for your firm.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              <Link
                href="/demo"
                className="inline-flex h-12 items-center justify-center rounded-full border border-gray-600 px-7 text-base font-medium tracking-tight text-paper transition-colors duration-200 hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Try the Dashboard
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
