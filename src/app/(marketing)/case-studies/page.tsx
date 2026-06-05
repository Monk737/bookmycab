import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";

export const metadata: Metadata = {
  title: "Case Studies — BookMyCab",
  description:
    "Representative, illustrative examples of how a bespoke BookMyCab automation handles the realities of a private-hire fleet and an airport-transfer specialist — challenge, bespoke solution and the outcomes to expect.",
};

type Metric = { value: string; label: string };
type CaseStudy = {
  segment: string;
  title: string;
  challenge: string;
  solution: string;
  outcomes: Metric[];
};

// §9.1 — REPRESENTATIVE, ILLUSTRATIVE examples. No real customer names, logos
// or numbers are presented as factual. These exist to show the shape of a
// bespoke build; real studies slot into the same structure as they land.
const CASE_STUDIES: CaseStudy[] = [
  {
    segment: "UK private-hire fleet",
    title: "A 60-car town firm reclaiming its after-hours bookings",
    challenge:
      "Evening and weekend demand spilled past what the phone line could answer. Missed calls meant missed fares, and the office had no clear picture of how many rides were slipping away.",
    solution:
      "A bespoke automation built around the firm's own fares and AutoCab dispatch, answering on WhatsApp and an on-site chat widget. ASAP, scheduled and managed bookings handled in a single conversation, confirmed straight into dispatch.",
    outcomes: [
      { value: "24/7", label: "Booking coverage, no extra night staff" },
      { value: "< 3s", label: "Typical time from message to bot reply" },
      { value: "1 conversation", label: "From enquiry to confirmed ride" },
    ],
  },
  {
    segment: "Airport-transfer specialist",
    title: "An airport specialist handling flights that never run on time",
    challenge:
      "Pre-booked airport runs fell apart when flights shifted. Customers re-messaged to change times, and matching the right terminal to the right pickup ate up the team's day.",
    solution:
      "A bespoke airport flow with live flight tracking and terminal-aware routing — LHR terminal zones mapped correctly — plus a manage-booking path so customers adjust their own pickups when a flight moves.",
    outcomes: [
      { value: "Terminal-aware", label: "Right terminal, every airport run" },
      { value: "Self-serve", label: "Customers manage their own changes" },
      { value: "Fewer reruns", label: "Less rework when a flight shifts" },
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <>
      {/* Header */}
      <Section className="pb-10 sm:pb-14">
        <Container className="max-w-3xl">
          <Badge>Case studies</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            What a bespoke build looks like in practice.
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            The examples below are representative — illustrative of the kind of
            firm we build for and the outcomes to expect. They show the shape of
            a bespoke automation, honestly framed.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Illustrative disclaimer */}
      <Section className="pb-4 pt-0 sm:pb-6 sm:pt-0">
        <Container>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 sm:px-6">
            <p className="text-sm leading-relaxed text-gray-600">
              <span className="font-medium text-ink">
                These are representative examples.
              </span>{" "}
              We&apos;re early and we&apos;d rather be straight with you than
              dress up someone else&apos;s logo. No real customer names or figures
              are shown here. As live firms agree to be named, their real stories
              will appear in this same format.
            </p>
          </div>
        </Container>
      </Section>

      {/* Case study cards */}
      <Section className="py-12 sm:py-16">
        <Container>
          <div className="grid gap-6 lg:gap-8">
            {CASE_STUDIES.map((study) => (
              <article
                key={study.title}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-paper"
              >
                <div className="p-7 sm:p-10">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge>{study.segment}</Badge>
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400">
                      Representative example
                    </span>
                  </div>
                  <h2 className="mt-5 text-balance font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
                    {study.title}
                  </h2>

                  <div className="mt-8 grid gap-8 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
                        The challenge
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-gray-600">
                        {study.challenge}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
                        The bespoke solution
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-gray-600">
                        {study.solution}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Outcome metrics */}
                <div className="grid gap-px border-t border-gray-200 bg-gray-200 sm:grid-cols-3">
                  {study.outcomes.map((metric) => (
                    <div key={metric.label} className="bg-paper p-7 sm:p-8">
                      <p className="font-display text-3xl font-semibold tracking-tight text-ink">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-600">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* Closing CTA band */}
      <Section className="py-14 sm:py-20">
        <Container>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-7 py-14 text-center sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
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
