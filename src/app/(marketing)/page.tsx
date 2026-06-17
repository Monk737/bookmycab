import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { Button } from "@/components/marketing/ui/button";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import Link from "next/link";
import { BookingConversation } from "@/components/marketing/booking-conversation";
import { VoiceCall } from "@/components/marketing/voice-call";
import { VoiceLiveCard } from "@/components/marketing/voice-live-card";
import { MotionReel } from "@/components/marketing/motion-reel";
import { ChannelLogos } from "@/components/marketing/channel-logos";
import { CommandCentre } from "@/components/marketing/command-centre";
import { Reveal } from "@/components/marketing/reveal";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "BookMyCab, An AI voice agent and WhatsApp bot for your cab firm",
  description:
    "An AI voice agent that answers your phone and a WhatsApp bot that takes bookings by chat. Both quote the fare, confirm the trip and book straight into AutoCab, iCabbi or Cordic, around the clock.",
};

// The real ordered flow, call or message in, booked, dispatched. A genuine
// sequence, so the numbered markers carry information rather than decorate.
const STEPS = [
  {
    n: "01",
    title: "A call or a message lands",
    body: "Someone phones the booking line or messages on WhatsApp, by text or voice note, at 2 in the afternoon or 2 in the morning. Every one gets answered on the first ring.",
  },
  {
    n: "02",
    title: "The agent books it",
    body: "It listens or reads, works out what the customer wants, quotes the fare, picks the vehicle and confirms pickup, destination and time, all inside the call or chat.",
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
                Answer every call,{" "}
                <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
                  day or night
                </span>
                .
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-gray-700 sm:text-xl">
                An AI voice agent picks up your phone and takes the booking by
                speaking, and a WhatsApp bot does the same by chat. Both quote
                the fare, confirm the trip and write it straight into your
                dispatch. Around the clock, with no extra staff on the desk.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <DiscoveryCta size="lg" />
                <TryDashboardLink size="lg" />
              </div>
              <p className="mt-6 inline-flex border-2 border-ink bg-paper px-3 py-1.5 text-sm font-semibold text-ink shadow-brut-sm">
                Set up around your firm by our team, not a sign-up form.
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
                "AI Voice Agent",
                "Answers the phone",
                "WhatsApp",
                "Voice notes",
                "Airport runs",
                "After hours",
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

      {/* AI Voice spotlight — the hero product, with a live call animation. */}
      <Section id="ai-voice" className="border-b-[3px] border-ink bg-canvas py-16 sm:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-16">
            {/* Live call demo */}
            <div className="order-2 flex justify-center lg:order-1 lg:block">
              <VoiceCall />
            </div>

            {/* Selling content */}
            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 border-2 border-ink bg-brut-yellow px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                <span className="status-pulse inline-block h-2 w-2 border border-ink bg-brut-lime" aria-hidden="true" />
                The AI Voice Booking Agent
              </span>
              <h2 className="mt-5 text-balance font-display text-4xl font-extrabold uppercase leading-[0.98] tracking-[-0.03em] text-ink sm:text-5xl">
                Always picks up.{" "}
                <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
                  Never clocks off
                </span>
                .
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-700">
                It answers your booking line on the first ring, takes the whole
                job by talking, quotes the fare and writes it into dispatch. No
                wages, no rota, no sick days, and it never puts a caller on hold.
              </p>

              <ul className="mt-8 space-y-3.5">
                {[
                  ["Answers in one ring, 24/7", "At 3am and on your busiest Saturday alike. No engaged tone, no fare lost to the rank or the firm down the road."],
                  ["Sounds like your best controller", "A natural British voice under your firm's name, quoting your fares and asking only what it needs to."],
                  ["Works the hours nobody wants", "The 2am chucking-out rush and the dead-of-night airport run, handled while the office is dark."],
                  ["Answering calls the same day", "Point your booking number at it and it picks up. Nothing to install, no new screen for your team."],
                ].map(([k, v]) => (
                  <li key={k} className="flex gap-3.5">
                    <span aria-hidden="true" className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-brut-lime text-xs font-bold text-ink">
                      ✓
                    </span>
                    <p className="text-base leading-relaxed text-gray-700">
                      <span className="font-display font-extrabold uppercase tracking-tight text-ink">{k}.</span>{" "}
                      {v}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <VoiceLiveCard sub="See the agent take a booking" />
                <DiscoveryCta size="lg" label="Add one to your team" />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* How it works, real 3-step sequence. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-extrabold tracking-[-0.02em] text-ink sm:text-4xl">
              First call to dispatched cab, no human in the middle
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              One conversation does the whole job. Here is what happens between a
              customer&apos;s first call or message and a driver pulling up.
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

      {/* Always-on, two products, art-directed dark band for contrast. */}
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
                Your phone can ring out. The voice agent can&apos;t. Every call
                is picked up on the first ring and every WhatsApp gets a reply in
                seconds, at 9am on your busiest Saturday and at 3am when the
                office is dark. No queue, no hold music, no voicemail nobody
                checks.
              </p>
              <p className="mt-5 text-lg leading-relaxed text-gray-300">
                A customer who phones today and sends a WhatsApp next week is one
                customer to you, with one history, not two conversations to
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
                Two products, one automation
              </p>
              <ChannelLogos variant="onDark" className="mt-6" />
              <p className="mt-8 max-w-md leading-relaxed text-gray-400">
                The voice agent and the WhatsApp bot run on the same automation,
                the same dispatch and the same customer list. Nothing new for
                your controllers to learn, nothing extra to log into.
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

      {/* The dashboard story — what the operator watches once the agent is live.
          Selling copy on the left, a brutalist faux-dashboard on the right. */}
      <Section className="border-t-[3px] border-ink py-16 sm:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 border-2 border-ink bg-brut-cyan px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                Your command centre
              </span>
              <h2 className="mt-5 text-balance font-display text-3xl font-extrabold uppercase leading-[1] tracking-[-0.02em] text-ink sm:text-4xl">
                You don&apos;t just trust it.{" "}
                <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
                  You watch it work
                </span>
                .
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-700">
                The agent answers and books. The dashboard puts all of it on one
                screen, with no reports to pull and nothing for your controllers
                to fill in. Open it between calls and see what booked, what
                slipped, and the money it won back.
              </p>

              <ul className="mt-8 space-y-3.5">
                {[
                  ["Every call and chat, logged", "Transcribed, scored and saved against the customer. Filter to any day, search a name, open any job and read exactly what was said."],
                  ["Booking intelligence", "The revenue behind the week, not just the count: fares booked, average fare and booked-rate, your busiest hours and days, top routes and airport runs, vehicle mix, and the repeat riders worth chasing."],
                  ["Fares the agent won back", "It flags the calls that nearly slipped and chases them. You see the value recovered, in pounds, on the board."],
                  ["Graded, and self-tuning", "Every call rated for caller mood and outcome. The ones worth a listen rise to the top, and the agent suggests its own script tweaks."],
                  ["The Monday briefing", "A plain-English read of your week, written fresh every Monday: what changed, what cost you bookings, and one fix to try."],
                ].map(([k, v]) => (
                  <li key={k} className="flex gap-3.5">
                    <span aria-hidden="true" className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-brut-lime text-xs font-bold text-ink">
                      ✓
                    </span>
                    <p className="text-base leading-relaxed text-gray-700">
                      <span className="font-display font-extrabold uppercase tracking-tight text-ink">{k}.</span>{" "}
                      {v}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-9">
                <TryDashboardLink size="lg" label="See the live demo dashboard" />
              </div>
            </div>

            <div className="lg:pl-4">
              <CommandCentre />
            </div>
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

      {/* Missed fares — pointer to the full ROI calculator on Pricing. */}
      <Section className="border-t-[3px] border-ink py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Every missed call is a fare for the firm down the road
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              When your line is engaged or it is the middle of the night, the
              customer does not wait. They book elsewhere. Our ROI calculator
              takes your fleet size and average fare and shows what an always-on
              automation puts back on the meter, every month.
            </p>
          </div>
          <div className="mt-8">
            <Link
              href="/pricing#roi"
              className="live-glow brut-focus group inline-flex items-center gap-3 border-[3px] border-ink bg-brut-yellow px-7 py-4 transition-transform duration-150 hover:-translate-y-0.5"
            >
              <span className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">
                Calculate your missed fares
              </span>
              <span
                aria-hidden="true"
                className="text-ink transition-transform duration-150 group-hover:translate-x-1.5"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
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
              No data, no app, no problem. A customer calls your number or sends
              a WhatsApp, books by speaking or typing, and your cab is on its
              way.
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
              Book a 20-minute discovery call and we will map your phone line,
              WhatsApp, fares and dispatch into an automation built for your firm.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <DiscoveryCta size="lg" />
              <TryDashboardLink size="lg" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
