import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";

export const metadata: Metadata = {
  title: "How It Works — BookMyCab",
  description:
    "From a discovery call to going live: how we scope, quote and build your bespoke cab automation — never a template clone — then connect your channels and run a 30-day hypercare.",
};

// The customer journey — PRD §9.2 public framing, §5.1.
const STEPS = [
  {
    n: "01",
    title: "Book a discovery call",
    body: "We start with a conversation about your firm — your fleet, your channels, your busiest hours and where calls go unanswered today.",
  },
  {
    n: "02",
    title: "We scope & quote",
    body: "You get clear options — A, B or C — sized to your fleet and the booking flows you actually need. Transparent pricing, no surprises.",
  },
  {
    n: "03",
    title: "We build your bespoke automation",
    body: "Your automation is built around your own fares, vehicles and dispatch system. Bespoke per customer — never a template clone of someone else's bot.",
  },
  {
    n: "04",
    title: "Connect your channels",
    body: "We connect the channels your customers already use — WhatsApp, Telegram, Messenger, Instagram and an on-site chat widget — to your bespoke build.",
  },
  {
    n: "05",
    title: "Go live with 30-day hypercare",
    body: "We switch you on and stay close for 30 days of hypercare — watching every run, tuning the experience and making sure each booking lands cleanly in your dispatch.",
  },
];

// Booking modes the automation handles end-to-end — PRD §5.1.
const BOOKING_MODES = [
  {
    title: "ASAP",
    body: "A customer needs a cab now. Your automation captures the pickup, destination and vehicle, quotes the fare and confirms — in one conversation.",
  },
  {
    title: "Scheduled",
    body: "Booking ahead for later today or next week? Pickup time is captured up front and the journey is held against the right slot.",
  },
  {
    title: "Airport pickup",
    body: "Live flight tracking and terminal-aware routing handle airport runs — the right terminal, the right timing, even when a flight shifts.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>How it works</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            From discovery call to live, on autopilot.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            We don&apos;t hand you a generic bot. We scope your firm, quote it
            honestly and build an automation around your fleet and dispatch —
            then stay close while you go live.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Journey steps */}
      <Section className="py-14 sm:py-20">
        <Container>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            Your journey, in five steps
          </p>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="bg-paper p-7 sm:flex sm:gap-8 sm:p-9"
              >
                <span className="font-display text-3xl font-semibold tabular-nums text-gray-300 sm:w-24 sm:shrink-0 sm:text-4xl">
                  {step.n}
                </span>
                <div className="mt-3 sm:mt-0">
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Bespoke emphasis */}
      <Section className="py-14 sm:py-20">
        <Container className="max-w-3xl text-center">
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Bespoke per customer — never a template clone.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            Every cab company gets an automation built for its own fares,
            vehicles and dispatch system. No two builds are the same, because no
            two firms are.
          </p>
        </Container>
      </Section>

      {/* Booking modes */}
      <Section className="py-14 sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Every booking mode, one conversation
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            ASAP rides, scheduled journeys and airport runs — all handled in a
            single natural conversation with your customer.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {BOOKING_MODES.map((mode) => (
              <div key={mode.title} className="bg-paper p-7 sm:p-8">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {mode.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {mode.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Ready to see what your bespoke build looks like?
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
