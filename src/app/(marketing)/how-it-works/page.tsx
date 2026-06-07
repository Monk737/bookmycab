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
    "From a customer's message to a dispatched cab, and from a discovery call to going live: how your custom automation reads bookings, even voice notes, and lands them in AutoCab, iCabbi or Cordic.",
};

// The customer journey, PRD §9.2 public framing, §5.1.
const STEPS = [
  {
    n: "01",
    title: "Book a discovery call",
    body: "We start with a conversation about your firm: your fleet, your channels, your busiest hours and where calls go unanswered today.",
  },
  {
    n: "02",
    title: "We scope and quote",
    body: "You get clear options, Ignition, In Motion or Full Throttle, sized to your fleet and the booking flows you actually need. Transparent pricing, no surprises.",
  },
  {
    n: "03",
    title: "We build it around your firm",
    body: "We build around your own fares, vehicles and dispatch. Your bot is yours alone, tuned to how your firm actually talks to its customers, not a skin on someone else's.",
  },
  {
    n: "04",
    title: "Connect your channels",
    body: "We connect the channels your customers already use, WhatsApp, Telegram, Messenger, Instagram and an on-site chat widget, to your build.",
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
            From a message to a{" "}
            <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
              dispatched cab
            </span>
            .
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            One chat does the whole job, whether the customer types it or sends a
            voice note. Below: exactly what happens between their first message
            and a driver pulling up, and how we build it for your firm.
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
              Two ways to book.{" "}
              <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
                One bot.
              </span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">
              Customers reach for whatever is quickest. The chatbot handles both
              the same way, end to end. Here is each one on its own.
            </p>
          </div>

          <div className="mt-10 grid gap-[3px] overflow-hidden border-[3px] border-paper md:grid-cols-2">
            {[
              {
                tag: "Mode 1",
                tone: "bg-brut-cyan",
                title: "Text chatbot",
                lead: "Tap a quick-reply button or type a line. Nothing to install, no voice note required.",
                steps: [
                  ["Tap or type", "“Book a cab”, then the pickup and drop-off, by button or keyboard."],
                  ["Bot reads it", "Pulls the address, destination, time and vehicle straight from the chat."],
                  ["Confirm and done", "Fare shown, one tap to confirm, job written into dispatch."],
                ],
              },
              {
                tag: "Mode 2",
                tone: "bg-brut-pink",
                title: "Voice note booking",
                lead: "Too busy to type? Hold the mic and talk. A ten-second note from a noisy street is enough.",
                steps: [
                  ["Send a voice note", "“Fourteen Mill Road to Stansted, half six tomorrow.”"],
                  ["Bot transcribes it", "Speech turned to text, accents and background noise handled."],
                  ["Confirm and done", "Same fare quote, same one-tap confirm, same dispatch hand-off."],
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
              We don&apos;t hand you a generic bot. We scope your firm, quote it
              honestly, build around your fleet and dispatch, then stay close
              while you go live.
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
              shape: your channels, your fares, your dispatch, wired together.
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
