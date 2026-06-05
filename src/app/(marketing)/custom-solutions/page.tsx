import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";

export const metadata: Metadata = {
  title: "Custom Solutions — BookMyCab",
  description:
    "Beyond booking. For larger fleets, more channels or anything outside our standard options, we scope and quote bespoke automations individually — support bots, driver tools, lost property, complaints, marketing, custom integrations and inbound voice.",
};

// §6.1 Option C — quoted-individually framing.
const OPTION_C = [
  {
    title: "101+ vehicle fleets",
    body: "Larger operations have their own scale, shift patterns and dispatch demands. We size the build to your fleet rather than squeezing you into a tier.",
  },
  {
    title: "Four or more channels",
    body: "Running everywhere at once — and adding channels beyond our standard set — is scoped to what your customers actually use.",
  },
  {
    title: "Anything outside A or B",
    body: "Non-standard dispatch, unusual booking flows or requirements we haven't met before. If it falls outside our standard options, we quote it individually.",
  },
];

// §6.3 — add-on automations beyond the core booking build.
const ADD_ONS = [
  {
    name: "Support Bot",
    body: "An automation that answers your customers' common questions — fares, coverage, account queries — so your team isn't tied up on the basics.",
  },
  {
    name: "Driver Solution",
    body: "A dedicated assistant for your drivers — shift queries, job details and the answers they need without calling the office.",
  },
  {
    name: "Lost Property Bot",
    body: "Logs and triages lost-property reports automatically, matching them to journeys so items get back to customers faster.",
  },
  {
    name: "Complaints & CSAT",
    body: "Captures complaints calmly, routes them to the right person and runs post-ride satisfaction follow-ups so you can see how you're really doing.",
  },
  {
    name: "Marketing automations",
    body: "Re-engagement for lapsed riders, loyalty nudges and promotions — sent on the channels your customers already use, from your own customer base.",
  },
  {
    name: "Custom integrations",
    body: "Non-AutoCab dispatch, your CRM, your accounting stack — we connect the bespoke build to the systems you already run.",
  },
  {
    name: "Additional channels",
    body: "Beyond our standard five. If your customers reach you somewhere else, we can bring that channel into the same automation.",
  },
  {
    name: "Voice agent",
    body: "Inbound call handling — an AI voice agent that answers the phone and takes bookings out loud. On our roadmap for v1.3.",
    roadmap: true,
  },
];

export default function CustomSolutionsPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>Custom solutions</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            When your firm needs more than booking.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Larger fleets, extra channels and bespoke automations sit outside our
            standard options — so we scope and quote them individually, built
            around how your business actually runs.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" label="Contact us — quoted individually" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Option C framing */}
      <Section className="py-14 sm:py-20">
        <Container>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            Option C — quoted individually
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            101+ fleet, four or more channels, or anything outside A and B.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            There&apos;s no fixed price list here, on purpose. We look at your
            operation and quote it honestly — no template, no tier you have to
            bend yourself to fit.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-3">
            {OPTION_C.map((item) => (
              <div key={item.title} className="bg-paper p-7 sm:p-8">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Add-on automations */}
      <Section className="py-14 sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Add-on automations
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            Bolt these onto your core booking build, or run them on their own.
            Each one is scoped to your firm and quoted individually.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <div key={addon.name} className="bg-paper p-7 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold text-ink">
                    {addon.name}
                  </h3>
                  {addon.roadmap ? (
                    <span className="mt-0.5 shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.1em] text-gray-500">
                      Roadmap
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-base leading-relaxed text-gray-600">
                  {addon.body}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Transparency emphasis */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-ink bg-accent px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-accent-ink sm:text-4xl">
              Quoted individually — never a template clone.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              Every custom build is scoped to your fleet, your channels and your
              dispatch. You bring your numbers. You own your customer base. The
              only way to price it is to talk.
            </p>
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Tell us what you need built.
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" label="Contact us — quoted individually" />
              <TryDashboardLink size="lg" />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
