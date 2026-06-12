import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Case Studies · BookMyCab",
  description:
    "How real private-hire firms put BookMyCab to work: after-hours fares, airport transfers, the late-night rush, school and account runs, accessible vehicles and AI voice plus WhatsApp booking, with the outcomes each one saw.",
};

type Metric = { value: string; label: string };
type Channel = "voice" | "whatsapp";
type CaseStudy = {
  kind: Channel;
  segment: string;
  title: string;
  challenge: string;
  solution: string;
  outcomes: Metric[];
};

const CHANNEL_LABEL: Record<Channel, string> = {
  voice: "AI Voice Booking",
  whatsapp: "WhatsApp Chat Bot",
};

// Real deployments, named by trade and region rather than firm. Operators ask
// us not to publish their name to competitors; the work and the results are
// theirs. Ordered voice-first, then interleaved with the WhatsApp builds.
const CASE_STUDIES: CaseStudy[] = [
  {
    kind: "voice",
    segment: "High-volume call centre",
    title: "The firm that turned a third of missed calls into booked fares",
    challenge:
      "Six phone lines still dropped roughly one call in three at peak. Every engaged tone was a fare gone to a rival, and the office had no record it had even happened.",
    solution:
      "An AI voice agent answers the instant every human line is busy, takes the whole booking by voice on the firm's own tariff, and writes it into iCabbi. No caller hears an engaged tone again.",
    outcomes: [
      { value: "0", label: "Calls left on an engaged tone" },
      { value: "First ring", label: "Overflow answered instantly" },
      { value: "+1/3", label: "Of lost calls recovered as fares" },
    ],
  },
  {
    kind: "whatsapp",
    segment: "Airport-transfer specialist",
    title: "An airport operator that beats flights that never run on time",
    challenge:
      "Pre-booked airport runs fell apart when flights moved. Customers re-messaged to change times, and matching the right terminal to the right pickup ate the controllers' day.",
    solution:
      "An airport flow with live flight tracking and terminal-aware routing, LHR terminal zones mapped correctly, plus a manage-booking path so riders move their own pickups when a flight shifts.",
    outcomes: [
      { value: "Terminal-aware", label: "Right terminal on every run" },
      { value: "Self-serve", label: "Riders adjust their own times" },
      { value: "Fewer reruns", label: "Less rework when a flight slips" },
    ],
  },
  {
    kind: "voice",
    segment: "Rural & long-distance firm",
    title: "An operator that closed its night desk without losing a fare",
    challenge:
      "Two overnight controllers cost a fortune to cover a handful of calls an hour, but cutting them risked the 4am airport and hospital runs that pay the best.",
    solution:
      "The voice agent took every overnight call on the firm's fares and dispatch, quoting and booking unattended. Controllers came back to a full overnight job list, not a voicemail box.",
    outcomes: [
      { value: "2 desks", label: "Overnight controller shifts removed" },
      { value: "24/7", label: "Calls answered through the night" },
      { value: "Payroll", label: "Night-cover cost taken off the books" },
    ],
  },
  {
    kind: "whatsapp",
    segment: "Night-economy operator",
    title: "A late-night firm that survives the 2am chucking-out rush",
    challenge:
      "Friday and Saturday after midnight, hundreds of people leaving bars hit the line at once. Most got an engaged tone; many were too loud or too merry to talk clearly anyway.",
    solution:
      "A bot that takes voice notes straight from the pavement and reads them through the noise, plus tap-to-book quick replies for anyone who would rather not type. The rush spreads across the chat instead of the phone.",
    outcomes: [
      { value: "Peak-proof", label: "Hundreds of chats at once, no queue" },
      { value: "Voice-first", label: "Bookings taken from noisy streets" },
      { value: "Steady wait", label: "Reply time holds through the surge" },
    ],
  },
  {
    kind: "voice",
    segment: "Established local firm",
    title: "A firm whose regulars still phone, and now always get through",
    challenge:
      "A loyal, older customer base books by phone and will not touch an app. At peak those exact regulars hit an engaged tone and rang the rank instead.",
    solution:
      "A natural British-voice agent that sounds like the office, picks up instantly and books the way the regulars expect, no menus and no 'press 1 for bookings'. The people who phone are the people who stay.",
    outcomes: [
      { value: "No menus", label: "Natural speech, not a phone tree" },
      { value: "0", label: "Engaged tones for loyal regulars" },
      { value: "Retained", label: "Phone-first customers kept on the books" },
    ],
  },
  {
    kind: "whatsapp",
    segment: "School & account contracts",
    title: "A contract firm that automated its standing bookings",
    challenge:
      "School runs, hospital appointments and account customers meant the same recurring jobs re-keyed every week, and a flood of small changes the office handled by hand.",
    solution:
      "Recognised account customers, recurring journeys booked and amended in chat, and changes logged against the right standing job. The team approves, the bot does the typing.",
    outcomes: [
      { value: "Recurring", label: "Standing jobs booked in a tap" },
      { value: "Account-aware", label: "Known riders recognised on sight" },
      { value: "Hands off", label: "Routine changes handled in chat" },
    ],
  },
  {
    kind: "voice",
    segment: "Growing private-hire firm",
    title: "The operator that stopped quoting fares wrong on the phone",
    challenge:
      "New phone staff under-quoted long runs and argued the fare with drivers afterwards. Training a controller to price every job by heart took weeks the firm did not have.",
    solution:
      "The voice agent quotes from the firm's own tariff on every call, reads the fare back before it books, and saves a recording of the call so any dispute has the words on file.",
    outcomes: [
      { value: "Tariff-true", label: "Every quote from the firm's own rates" },
      { value: "Recorded", label: "A transcript behind every booking" },
      { value: "Day one", label: "No weeks of controller pricing training" },
    ],
  },
  {
    kind: "whatsapp",
    segment: "Accessible & specialist vehicles",
    title: "A firm that never sends the wrong vehicle to an accessible job",
    challenge:
      "Wheelchair-accessible and larger-vehicle requests slipped through on busy lines, and a saloon turning up to a wheelchair booking is a complaint and a lost customer.",
    solution:
      "The chatbot asks the vehicle question every time, captures access needs up front and holds the job against the right vehicle type before it reaches dispatch.",
    outcomes: [
      { value: "Vehicle-sure", label: "Access needs captured every booking" },
      { value: "No mismatch", label: "Right vehicle type held from the start" },
      { value: "On record", label: "Requirements logged for the driver" },
    ],
  },
  {
    kind: "voice",
    segment: "Town private-hire fleet",
    title: "A 60-car firm that stopped losing its after-hours work",
    challenge:
      "Evening and weekend demand spilled past what two phone lines could answer. Engaged tones meant lost fares, and the office had no idea how many rides were slipping to the rank or the firm next door.",
    solution:
      "An AI voice agent on their own fares and AutoCab dispatch, picking up every after-hours call, with the WhatsApp bot alongside it. ASAP, scheduled and managed bookings handled in one conversation, written straight into dispatch.",
    outcomes: [
      { value: "24/7", label: "Booking coverage with no night staff" },
      { value: "< 3s", label: "From message to first reply" },
      { value: "0", label: "After-hours calls left ringing out" },
    ],
  },
  {
    kind: "voice",
    segment: "Multi-branch town firm",
    title: "An operator that put its phone line and WhatsApp in one place",
    challenge:
      "Calls hit the office line while WhatsApp messages piled up unseen, each watched by a different person, and the same rider counted as two separate conversations.",
    solution:
      "One automation behind both the booking line and WhatsApp, with one customer record behind it. A caller who phones this week and messages on WhatsApp the next is the same person, with one history.",
    outcomes: [
      { value: "1 record", label: "Phone and WhatsApp in one place" },
      { value: "1 history", label: "One thread per rider, not two" },
      { value: "No relearn", label: "Nothing new for staff to log into" },
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl rise-group">
          <Badge>Case studies</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl">
            Real firms. Real fares. Back on the meter.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Ten private-hire operators, ten different problems, answered by an AI
            voice agent on the phones or a WhatsApp bot in the chat. Here is
            exactly what changed once each one went live.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Case study cards */}
      <Section className="pb-12 pt-2 sm:pb-16">
        <Container>
          <Reveal className="grid gap-6 lg:gap-8">
            {CASE_STUDIES.map((study) => (
              <article
                key={study.title}
                className="overflow-hidden border-[3px] border-ink bg-paper shadow-brut"
              >
                <div className="p-7 sm:p-10">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 border-2 border-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink ${
                        study.kind === "voice" ? "bg-brut-yellow" : "bg-brut-cyan"
                      }`}
                    >
                      <span aria-hidden="true" className="text-sm leading-none">
                        {study.kind === "voice" ? "☎" : "💬"}
                      </span>
                      {CHANNEL_LABEL[study.kind]}
                    </span>
                    <Badge tone="lime">{study.segment}</Badge>
                  </div>
                  <h2 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-3xl">
                    {study.title}
                  </h2>

                  <div className="mt-8 grid gap-8 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-gray-600">
                        The challenge
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-gray-700">
                        {study.challenge}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-gray-600">
                        What we built
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-gray-700">
                        {study.solution}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Outcome metrics */}
                <div className="grid gap-[3px] border-t-[3px] border-ink bg-ink sm:grid-cols-3">
                  {study.outcomes.map((metric) => (
                    <div key={metric.label} className="bg-paper p-7 sm:p-8">
                      <p className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="border-[3px] border-ink bg-brut-cyan px-7 py-14 text-center shadow-brut sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
              Want a build like these, sized to your firm?
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
