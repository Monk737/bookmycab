import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { Button } from "@/components/marketing/ui/button";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { BookingConversation } from "@/components/marketing/booking-conversation";
import { MotionReel } from "@/components/marketing/motion-reel";
import { ChannelLogos } from "@/components/marketing/channel-logos";
import { Reveal } from "@/components/marketing/reveal";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "BookMyCab, Your cab company, on every channel, on autopilot",
  description:
    "Custom AI booking and support automations for the global taxi industry. BookMyCab answers every channel, takes bookings around the clock, and books straight into your dispatch system.",
};

// The real ordered flow, message in, booked, dispatched. A genuine sequence,
// so the numbered markers carry information rather than decorate.
const STEPS = [
  {
    n: "01",
    title: "A message lands",
    body: "WhatsApp, Telegram, Messenger, Instagram or your website. A typed line or a voice note, at 2 in the afternoon or 2 in the morning. Every single one gets answered.",
  },
  {
    n: "02",
    title: "The bot books it",
    body: "It reads the chat or transcribes the voice note, works out what the customer wants, quotes the fare, picks the vehicle and confirms the trip, all in the conversation.",
  },
  {
    n: "03",
    title: "It hits your dispatch",
    body: "The confirmed job drops into AutoCab, iCabbi or Cordic. Your drivers and controllers carry on exactly as they do today.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero, split: heavy headline + live booking conversation. */}
      <Section className="pt-12 pb-16 sm:pt-16 sm:pb-20">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16">
            <div className="rise-group">
              <Badge tone="lime">For taxi &amp; private-hire firms</Badge>
              <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl xl:text-7xl">
                Take every booking,{" "}
                <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
                  day or night
                </span>
                .
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-gray-700 sm:text-xl">
                A bespoke booking assistant that handles jobs by text or voice on
                the apps your customers already use, quoting the fare, confirming
                the trip and writing it straight into your dispatch. Around the
                clock, with no extra staff on the desk.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <DiscoveryCta size="lg" />
                <TryDashboardLink size="lg" />
              </div>
              <p className="mt-6 inline-flex border-2 border-ink bg-paper px-3 py-1.5 text-sm font-semibold text-ink shadow-brut-sm">
                Built for your firm, never a template. Set up by our team, not a sign-up form.
              </p>
            </div>

            <div className="lg:pl-4">
              <BookingConversation />
            </div>
          </div>
        </Container>
      </Section>

      {/* Marquee ticker band. */}
      <div className="overflow-hidden border-y-[3px] border-ink bg-ink py-3">
        <div className="brut-marquee flex w-max items-center gap-6 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, dup) => (
            <span key={dup} className="flex items-center gap-6" aria-hidden={dup === 1}>
              {[
                "WhatsApp",
                "Telegram",
                "Messenger",
                "Instagram",
                "Web widget",
                "Voice notes",
                "Airport runs",
                "AutoCab",
                "iCabbi",
                "Cordic",
                "Around the clock",
              ].map((word) => (
                <span key={word} className="flex items-center gap-6">
                  <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-paper">
                    {word}
                  </span>
                  <span className="inline-block h-2.5 w-2.5 bg-brut-yellow" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* How it works, real 3-step sequence. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-extrabold tracking-[-0.02em] text-ink sm:text-4xl">
              First message to dispatched cab, no human in the middle
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              One chat does the whole job. Here is what happens between a
              customer&apos;s first message and a driver pulling up.
            </p>
          </div>

          <Reveal as="ol" className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="brut-card brut-press flex flex-col p-6"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center border-[3px] border-ink bg-brut-yellow font-mono text-xl font-bold tabular-nums text-ink">
                  {step.n}
                </span>
                <h3 className="mt-5 font-display text-xl font-extrabold uppercase tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-700">
                  {step.body}
                </p>
              </li>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Always-on, every channel, art-directed dark band for contrast. */}
      <Section className="border-y-[3px] border-ink bg-ink py-20 sm:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="text-balance font-display text-4xl font-extrabold uppercase leading-[1] tracking-[-0.02em] text-paper sm:text-5xl">
                The line that{" "}
                <span className="box-decoration-clone bg-brut-yellow px-2 text-ink">
                  never goes engaged
                </span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-300">
                Your phone can ring out. This can&apos;t. Every message on every
                channel gets a reply in seconds, at 9am on your busiest Saturday
                and at 3am when the office is dark. No queue, no hold music, no
                voicemail nobody checks.
              </p>
              <p className="mt-5 text-lg leading-relaxed text-gray-300">
                A customer who books on Instagram today and WhatsApp next week is
                one customer to you, with one history, not two conversations to
                stitch together.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-[3px] overflow-hidden border-[3px] border-paper">
                {[
                  { n: "24/7", l: "Always answering" },
                  { n: "< 3s", l: "To first reply" },
                  { n: "0", l: "Calls left ringing" },
                ].map((s) => (
                  <div key={s.l} className="bg-gray-900 px-4 py-4 text-center">
                    <p className="font-display text-2xl font-extrabold tabular-nums text-brut-yellow sm:text-3xl">
                      {s.n}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-400">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pl-8">
              <p className="inline-block bg-brut-yellow px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                One bot, five front doors
              </p>
              <ChannelLogos variant="onDark" className="mt-6" />
              <p className="mt-8 max-w-md leading-relaxed text-gray-400">
                Add a channel and it joins the same bot, the same dispatch, the
                same customer list. Nothing new for your controllers to learn,
                nothing extra to log into.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Dispatch integrations. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              It writes the job into dispatch itself
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              The confirmed booking lands in AutoCab, iCabbi or Cordic on its own.
              Nothing to type in twice, nothing to reconcile when the shift ends.
              Your controllers see the job appear, same as always.
            </p>
          </div>
          <div className="mt-10">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* What it takes off the desk, before/after operator pains. */}
      <Section className="border-t-[3px] border-ink bg-canvas py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              What stops landing on your desk
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              The jobs that eat a controller&apos;s shift, gone. The bot picks
              them up so your people work the road, not the phones.
            </p>
          </div>
          <Reveal as="ul" className="mt-10 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink shadow-brut sm:grid-cols-2">
            {[
              { before: "Engaged tone at 1am", after: "Answered in seconds, every time" },
              { before: "Typing the job into AutoCab", after: "Written to dispatch on its own" },
              { before: "“Sorry, can you repeat the address?”", after: "Pickup pulled from text or voice" },
              { before: "Fares lost to the firm down the road", after: "Quoted, confirmed, kept" },
            ].map((row) => (
              <li key={row.before} className="bg-paper p-6 sm:p-7">
                <p className="text-base font-medium text-gray-500 line-through decoration-brut-red decoration-2">
                  {row.before}
                </p>
                <p className="mt-2 flex items-start gap-2 font-display text-lg font-extrabold uppercase tracking-tight text-ink">
                  <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border-2 border-ink bg-brut-lime text-xs">
                    ✓
                  </span>
                  {row.after}
                </p>
              </li>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Missed fares + ROI calculator. */}
      <Section className="border-t-[3px] border-ink py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Every missed call is a fare for the firm down the road
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
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

      {/* Ownership, split band: big claim on yellow, ownership ledger on ink. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="grid overflow-hidden border-[3px] border-ink shadow-brut-xl lg:grid-cols-[1.1fr_1fr]">
            {/* Claim panel */}
            <div className="flex flex-col justify-between gap-8 bg-brut-yellow p-8 sm:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/70">
                  The deal, in plain English
                </p>
                <h2 className="mt-4 text-balance font-display text-3xl font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-4xl">
                  You bring your numbers. You own your customer base.
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-ink/80">
                  We build and run the bot. The business it brings in, and
                  everyone it brings in, belongs to you. Walk away whenever and
                  it all walks with you.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button href="/how-it-works" variant="secondary" size="lg">
                  See how it works
                </Button>
                <Button href="/pricing" variant="ghost" size="lg">
                  View pricing
                </Button>
              </div>
            </div>

            {/* Ownership ledger */}
            <ul className="grid bg-ink">
              {[
                { k: "Your numbers", v: "Connected by you, billed to you, kept by you." },
                { k: "Your customers", v: "Every rider stays on your list, never ours." },
                { k: "Your data", v: "Bookings and history export any time you ask." },
                { k: "Your call", v: "No lock-in. Cancel and the door is open." },
              ].map((row, i) => (
                <li
                  key={row.k}
                  className={`flex items-baseline gap-4 px-7 py-5 sm:px-8 ${
                    i > 0 ? "border-t-2 border-gray-700" : ""
                  }`}
                >
                  <span className="font-mono text-sm font-bold tabular-nums text-brut-yellow">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="font-display text-lg font-extrabold uppercase tracking-tight text-paper">
                      {row.k}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-gray-400">
                      {row.v}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* On the street: illustrated reel of the dead-signal → booked-cab story. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              When the signal drops, the booking still goes through
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              No data, no app, no problem. A customer scans your hoarding or
              messages your number, books on WhatsApp by text or voice, and your
              cab is on its way.
            </p>
          </div>
          <div className="mt-10">
            <MotionReel />
          </div>
        </Container>
      </Section>

      {/* Closing CTA band. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="border-[3px] border-ink bg-ink px-7 py-16 text-center shadow-brut-xl sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-paper sm:text-5xl">
              {COMPANY.tagline}
            </h2>
            <p className="mx-auto mt-6 max-w-lg leading-relaxed text-gray-300">
              Book a 20-minute discovery call and we will map your channels,
              fares and dispatch into an automation built for your firm.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              {/* Demo not live yet — non-clickable + Coming Soon ribbon (dark-band styling). */}
              <span className="relative inline-flex">
                <span
                  aria-disabled="true"
                  title="Coming soon"
                  className="pointer-events-none inline-flex h-12 cursor-not-allowed items-center justify-center border-[3px] border-paper bg-ink px-7 text-base font-bold uppercase tracking-[0.04em] text-paper opacity-60"
                >
                  AI Voice Booking
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-2.5 -top-2.5 z-10 rotate-3 border-2 border-ink bg-brut-pink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink shadow-brut-sm"
                >
                  Coming Soon
                </span>
              </span>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
