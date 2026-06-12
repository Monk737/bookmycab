import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { Reveal } from "@/components/marketing/reveal";
import { COMPANY } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "About · BookMyCab",
  description:
    "BookMyCab is built by FlowMo AI LTD, made in the United Kingdom. We build AI voice agents and WhatsApp booking bots for cab firms, confident, technical, transparent, no hype. Your switchboard, your accounts, your drivers, answered faster.",
};

// What we believe / how we work. Plain principles, no hype.
const PRINCIPLES = [
  {
    title: "Configured around your firm",
    body: "Your voice agent and WhatsApp bot run on your own fares, vehicles and dispatch. One proven product, set up to match how your firm actually works.",
  },
  {
    title: "Transparent by default",
    body: "Clear options, honest quotes and no hidden margins. Channel and AI usage is billed by your own providers, at cost.",
  },
  {
    title: "You stay in control",
    body: "You connect your own numbers; we run the AI, the call minutes and the automation inside your plan. You keep the relationship with your customers.",
  },
  {
    title: "We stay close",
    body: "We don't switch you on and disappear. Thirty days of hypercare at go-live, watching every booking land cleanly in your dispatch.",
  },
];

// Who we build for, by trade.
const SEGMENTS = [
  "Town private-hire fleets",
  "Airport-transfer specialists",
  "Night-economy operators",
  "School & account contracts",
  "Accessible & specialist vehicles",
  "Multi-branch town firms",
];

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl rise-group">
          <Badge>About</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl">
            Built for cab firms, by {COMPANY.entity}.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            {COMPANY.product} is an AI voice agent that answers your phone and a
            WhatsApp bot that books by chat, then writes the job into your
            dispatch. We set it up around your own fleet and fares, so it books
            the way your best controller would, not the way some off-the-shelf
            menu makes a caller jump through hoops.
          </p>
          <p className="mt-4 text-base font-medium text-ink">
            Made in the {COMPANY.country} 🇬🇧
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Positioning, split: statement + "what that means" callout. */}
      <Section className="border-t-[3px] border-ink py-14 sm:py-20">
        <Container>
          <Reveal className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <span className="inline-block bg-brut-yellow px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-ink">
                How we talk
              </span>
              <h2 className="mt-5 font-display text-3xl font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-ink sm:text-4xl lg:text-5xl">
                Confident and technical,{" "}
                <span className="box-decoration-clone bg-ink px-2 text-paper">
                  without the hype.
                </span>
              </h2>
            </div>
            <div className="brut-hover-lift border-[3px] border-ink bg-paper p-7 shadow-brut sm:p-8">
              <p className="text-lg leading-relaxed text-gray-700">
                We&apos;re engineers who would rather show you a booking land in
                your dispatch than sell you a buzzword.
              </p>
              <Reveal as="ul" className="mt-6 space-y-3 border-t-2 border-ink pt-6">
                {[
                  "Every claim is one you can watch happen in the live dashboard.",
                  "You see your build working before you ever commit to it.",
                  "Plain nouns and verbs. We name what the product does, not what it might.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-base font-medium text-ink">
                    <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border-2 border-ink bg-brut-lime text-xs">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </Reveal>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Who we build for. */}
      <Section className="bg-canvas py-14 sm:py-20">
        <Container>
          <Reveal className="max-w-2xl">
            <span className="inline-block bg-brut-cyan px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-ink">
              By trade
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Who we build for
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              Private hire, top to bottom. If you run cars and take bookings, the
              build bends to your trade.
            </p>
          </Reveal>
          <Reveal as="ul" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENTS.map((seg, i) => {
              const tones = ["bg-brut-yellow", "bg-brut-cyan", "bg-brut-lime", "bg-brut-pink", "bg-brut-violet", "bg-paper"];
              return (
                <li
                  key={seg}
                  className={`brut-hover-lift group flex items-center gap-3 border-2 border-ink px-4 py-4 text-base font-bold uppercase tracking-[0.03em] text-ink shadow-brut-sm ${tones[i % tones.length]}`}
                >
                  <span
                    aria-hidden="true"
                    className="font-display text-lg font-extrabold tabular-nums text-ink/40 transition-colors duration-200 group-hover:text-ink"
                  >
                    0{i + 1}
                  </span>
                  {seg}
                </li>
              );
            })}
          </Reveal>
        </Container>
      </Section>

      {/* Principles, numbered manifesto list. */}
      <Section className="py-14 sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
            How we work
          </h2>
          <Reveal as="ol" className="mt-10 divide-y-2 divide-ink border-t-[3px] border-ink">
            {PRINCIPLES.map((principle, i) => (
              <li key={principle.title} className="grid gap-3 py-7 sm:grid-cols-[4rem_1fr] sm:gap-8">
                <span className="font-display text-3xl font-extrabold tabular-nums text-ink sm:text-4xl">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink sm:text-2xl">
                    {principle.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-700">
                    {principle.body}
                  </p>
                </div>
              </li>
            ))}
          </Reveal>
        </Container>
      </Section>

      {/* Transparency promise */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="border-[3px] border-ink bg-brut-yellow shadow-brut-xl px-7 py-12 sm:px-12 sm:py-16">
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-accent-ink/70">
              Our transparency promise
            </p>
            <h2 className="mt-4 text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-accent-ink sm:text-4xl">
              Worth keeping, never holding you hostage.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              Your numbers, your keys, your customers, all yours. We earn our
              place month to month by booking fares you would have lost, not by
              locking you in. Cancel and you walk away with everything you came
              in with.
            </p>
          </div>
        </Container>
      </Section>

      {/* What we won't do, punchy anti-promises. */}
      <Section className="border-t-[3px] border-ink bg-canvas py-14 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
            <h2 className="font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              Things we will never do
            </h2>
            <ul className="grid gap-[3px] self-start overflow-hidden border-[3px] border-ink bg-ink shadow-brut">
              {[
                "Sell you a half-finished bot and bill you to fix it",
                "Take ownership of your customers or your numbers",
                "Hide channel or AI costs behind a markup",
                "Switch you on and vanish",
                "Lock your data so you can't leave",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-3 bg-paper px-5 py-4 text-base font-bold text-ink"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-brut-red text-sm font-extrabold text-ink"
                  >
                    ✕
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="border-[3px] border-ink bg-brut-cyan px-7 py-14 text-center shadow-brut sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
              Let&apos;s talk about your firm.
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
