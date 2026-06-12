import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { ChannelFlow } from "@/components/marketing/channel-flow";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "How It Works · BookMyCab",
  description:
    "From a phone call or a WhatsApp to a dispatched cab, and from a discovery call to going live: how your AI voice agent and WhatsApp bot take bookings and land them in AutoCab, iCabbi or Cordic.",
};

// The customer journey, PRD §9.2 public framing, §5.1.
const STEPS = [
  {
    n: "01",
    title: "Book a discovery call",
    body: "We start with a conversation about your firm: your fleet, your phone line and WhatsApp, your busiest hours and where calls go unanswered today.",
  },
  {
    n: "02",
    title: "We scope and quote",
    body: "You get clear options, Ignition, In Motion or Full Throttle, sized to your fleet and the booking flows you actually need. Transparent pricing, no surprises.",
  },
  {
    n: "03",
    title: "We build it around your firm",
    body: "We set it up around your own fares, vehicles and dispatch, so the voice agent and WhatsApp bot answer the way your firm actually talks to its customers, on day one.",
  },
  {
    n: "04",
    title: "Connect your line and WhatsApp",
    body: "We point your booking number at the AI voice agent and connect your WhatsApp Business number to the bot. Both run on the one automation behind them.",
  },
  {
    n: "05",
    title: "Go live with 30-day hypercare",
    body: "We switch you on and stay close for 30 days, watching every run, tuning the experience and making sure each booking lands cleanly in your dispatch.",
  },
];

// Booking modes the automation handles end-to-end, PRD §5.1.
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
        <Container className="max-w-3xl rise-group">
          <Badge>How it works</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl xl:text-7xl">
            From a call to a{" "}
            <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
              dispatched cab
            </span>
            .
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            One conversation does the whole job, whether the customer calls and
            speaks or messages on WhatsApp. Below: exactly what happens between
            their first call and a driver pulling up, and how we build it for
            your firm.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Signature, the runtime flow diagram. */}
      <Section className="pb-16 pt-4 sm:pb-24">
        <Container>
          <ChannelFlow />
        </Container>
      </Section>

      {/* Two booking modes, each spelled out on its own, dark band. */}
      <Section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="max-w-3xl">
            <h2 className="text-balance font-display text-4xl font-extrabold uppercase leading-[1] tracking-[-0.02em] text-paper sm:text-5xl">
              Two products.{" "}
              <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
                One automation.
              </span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">
              Customers reach for whatever is quickest, the phone or WhatsApp.
              The same automation runs behind both, end to end. Here is each one
              on its own.
            </p>
          </div>

          <div className="mt-10 grid gap-[3px] overflow-hidden border-[3px] border-paper md:grid-cols-2">
            {[
              {
                tag: "Product 1",
                tone: "bg-brut-yellow",
                title: "AI Voice agent",
                lead: "Customers call your booking number and just talk. The agent answers on the first ring, no hold music, no queue.",
                steps: [
                  ["They call and speak", "“I need a cab from fourteen Mill Road to Stansted at half six.”"],
                  ["The agent listens", "It understands the request, asks only what it must, and reads the fare back."],
                  ["Confirm and done", "Pickup, destination and time confirmed out loud, job written into dispatch."],
                ],
              },
              {
                tag: "Product 2",
                tone: "bg-brut-cyan",
                title: "WhatsApp bot",
                lead: "Tap a button, type a line or hold the mic. Text or a ten-second voice note both work.",
                steps: [
                  ["Type or send a note", "“Fourteen Mill Road to Stansted, half six tomorrow.”"],
                  ["The bot reads it", "Text or speech, accents and background noise handled."],
                  ["Confirm and done", "Same fare quote, one tap to confirm, same dispatch hand-off."],
                ],
              },
            ].map((mode) => (
              <div key={mode.title} className="flex flex-col bg-gray-900 p-7 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className={`border-2 border-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink ${mode.tone}`}>
                    {mode.tag}
                  </span>
                  <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-paper">
                    {mode.title}
                  </h3>
                </div>
                <p className="mt-4 text-base leading-relaxed text-gray-300">
                  {mode.lead}
                </p>
                <ol className="mt-6 space-y-4 border-t-2 border-gray-700 pt-6">
                  {mode.steps.map(([k, v], i) => (
                    <li key={k} className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-paper bg-gray-900 font-mono text-xs font-bold text-brut-yellow">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-bold text-paper">{k}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-gray-400">{v}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Onboarding journey, clean numbered list. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              How we get you there
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              We scope your firm, quote it honestly, set the agent up around your
              fleet and dispatch, then stay close while you go live.
            </p>
          </div>

          <Reveal as="ol" className="mt-12 divide-y-2 divide-ink border-t-[3px] border-ink">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid gap-2 py-7 sm:grid-cols-[5rem_1fr] sm:gap-8"
              >
                <span className="font-display text-3xl font-extrabold tabular-nums text-ink sm:text-4xl">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-600">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Booking modes, differentiated list. */}
      <Section className="bg-canvas py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Every booking mode, one conversation
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              ASAP rides, scheduled journeys and airport runs all happen in a
              single natural conversation with your customer.
            </p>
          </div>
          <dl className="mt-10 divide-y-2 divide-ink border-t-[3px] border-ink">
            {BOOKING_MODES.map((mode) => (
              <div
                key={mode.title}
                className="grid gap-2 py-7 sm:grid-cols-[14rem_1fr] sm:gap-10"
              >
                <dt className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">
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

      {/* Closing CTA band, homepage parity. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="border-[3px] border-ink bg-ink px-7 py-16 text-center shadow-brut-xl sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-paper sm:text-5xl">
              Ready to see your build?
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-gray-300">
              Twenty minutes on a call and you will watch your own build take
              shape: your phone line, your WhatsApp, your fares and your
              dispatch, wired together.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center brut-press brut-focus border-[3px] border-paper bg-ink px-7 text-base font-bold uppercase tracking-[0.04em] text-paper shadow-[4px_4px_0_0_#ffffff]"
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
