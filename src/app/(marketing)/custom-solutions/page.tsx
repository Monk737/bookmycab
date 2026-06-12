import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Custom Solutions · BookMyCab",
  description:
    "Beyond booking. For larger fleets, very high call volume or anything outside our standard options, we scope and quote custom automations individually, support bots, driver tools, lost property, complaints, marketing and custom integrations.",
};

// Full Throttle (formerly Option C), quoted-individually framing.
const FULL_THROTTLE = [
  {
    title: "101+ vehicle fleets",
    body: "Bigger operations carry their own scale, shift patterns and dispatch load. We size the build to your fleet instead of squeezing you into a tier.",
  },
  {
    title: "Very high call volume",
    body: "Bigger operations carry their own call volume, shift patterns and busy-hour spikes. We size the build to your fleet and your busiest nights instead of squeezing you into a tier.",
  },
  {
    title: "Anything outside Ignition or In Motion",
    body: "Non-standard dispatch, unusual booking flows or something we have not met before. If it falls outside the fixed plans, we quote it on its own.",
  },
];

// §6.3, add-on automations beyond the core booking build. Each carries a short
// mono code so the list reads like an operator's capability sheet.
type AddOn = { code: string; name: string; body: string; roadmap?: boolean };

const ADD_ONS: AddOn[] = [
  {
    code: "SB",
    name: "Support Bot",
    body: "Answers the questions that tie up your office all day: fares, coverage, account and lost-booking queries, so your controllers stay on the radio, not the FAQ.",
  },
  {
    code: "DS",
    name: "Driver Solution",
    body: "A pocket assistant for your drivers. Shift queries, job details and quick answers, so the office phone stops ringing for things a bot can settle.",
  },
  {
    code: "LP",
    name: "Lost Property Bot",
    body: "Logs every lost-property report, matches it to the journey and chases it down, so a left-behind phone does not become a left-behind customer.",
  },
  {
    code: "CC",
    name: "Complaints & CSAT",
    body: "Takes the heat out of a complaint, routes it to the right person and runs a quick rating after the ride, so you hear about problems before a review does.",
  },
  {
    code: "MK",
    name: "Marketing automations",
    body: "Win back riders who went quiet, reward your regulars and push offers over WhatsApp, all from a list you own.",
  },
  {
    code: "CI",
    name: "Custom integrations",
    body: "Your CRM, your accounting stack, a dispatch system that isn't on our list. If your firm runs on it, we wire your build into it.",
  },
];

export default function CustomSolutionsPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl rise-group">
          <Badge>Custom solutions</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl">
            When your firm needs more than booking.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Larger fleets, very high call volume and custom automations sit
            outside our standard options, so we scope and quote them
            individually, built around how your business actually runs.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" label="Contact us, priced for you" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Full Throttle framing, split: statement panel + qualifying ledger. */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-14">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="inline-flex items-center border-2 border-ink bg-brut-violet px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink">
                Full Throttle, priced for you
              </span>
              <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-4xl">
                When your operation is too big for a fixed plan.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-gray-700">
                No fixed price list here, on purpose. We look at your fleet, your
                call volume and your dispatch, then quote it straight against what
                you actually run.
              </p>
              <div className="mt-7">
                <DiscoveryCta size="lg" label="Get a Full Throttle quote" />
              </div>
            </div>

            <ul className="grid gap-[3px] self-start overflow-hidden border-[3px] border-ink bg-ink shadow-brut">
              {FULL_THROTTLE.map((item, i) => (
                <li key={item.title} className="bg-paper p-7 sm:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center border-[3px] border-ink bg-brut-yellow font-mono text-xl font-bold tabular-nums text-ink">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-base leading-relaxed text-gray-700">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* Add-on automations, capability ledger, two columns of stacked rows. */}
      <Section className="bg-canvas py-14 sm:py-20">
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
                One booking bot is just the start
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-700">
                Bolt any of these onto your build, or run them on their own. Each
                is scoped to your firm and priced when we talk.
              </p>
            </div>
            <span className="inline-flex w-fit items-center border-2 border-ink bg-brut-lime px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink">
              {ADD_ONS.filter((a) => !a.roadmap).length} live · 1 on the way
            </span>
          </div>

          <Reveal as="ul" className="mt-10 grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink shadow-brut md:grid-cols-2">
            {ADD_ONS.map((addon) => (
              <li
                key={addon.name}
                className="group flex gap-4 bg-paper p-6 transition-colors duration-150 hover:bg-brut-yellow sm:p-7"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center border-[3px] border-ink bg-brut-cyan font-mono text-sm font-bold text-ink group-hover:bg-paper"
                >
                  {addon.code}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">
                      {addon.name}
                    </h3>
                    {addon.roadmap ? (
                      <span className="border-2 border-ink bg-brut-violet px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
                        Roadmap · v1.3
                      </span>
                    ) : (
                      <span className="border-2 border-ink bg-brut-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700 group-hover:text-ink">
                    {addon.body}
                  </p>
                </div>
              </li>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Transparency emphasis */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="border-[3px] border-ink bg-brut-yellow shadow-brut-xl px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-accent-ink sm:text-4xl">
              Priced for your firm, not a price list.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              Every custom build is scoped to your fleet, your booking line and
              WhatsApp and your dispatch, then quoted once we have seen how you
              actually run. No
              tier to squeeze into. The only way to price it is to talk.
            </p>
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="border-[3px] border-ink bg-brut-cyan px-7 py-14 text-center shadow-brut sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
              Tell us what you need built.
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" label="Contact us, priced for you" />
              <TryDashboardLink size="lg" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
