import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import {
  STATUS_COMPONENTS, PERF_TARGETS, STATUS_LABEL, overallStatus,
  type ComponentStatus,
} from "@/lib/marketing/status";

export const metadata: Metadata = {
  title: "Status · BookMyCab",
  description:
    "Live operational status of the BookMyCab platform, dashboard, gateway, automation engine, dispatch and data, plus the performance targets we hold ourselves to.",
};

const DOT: Record<ComponentStatus, string> = {
  operational: "bg-brut-lime border border-ink",
  degraded: "bg-brut-orange border border-ink",
  outage: "bg-brut-red border border-ink",
};

export default function StatusPage() {
  const overall = overallStatus(STATUS_COMPONENTS);

  return (
    <Section className="pb-14 sm:pb-20">
      <Container className="max-w-3xl">
        <Badge>Status</Badge>
        <h1 className="mt-6 text-balance font-display text-4xl font-extrabold uppercase leading-[1] tracking-[-0.02em] text-ink sm:text-5xl">
          Platform status
        </h1>

        <div className="mt-8 flex items-center gap-3 border-[3px] border-ink bg-canvas shadow-brut-sm px-6 py-5">
          <span className={`h-3.5 w-3.5 flex-shrink-0 ${DOT[overall]}`} aria-hidden />
          <p className="text-base font-medium text-ink">{STATUS_LABEL[overall]}</p>
        </div>

        <div className="mt-10 divide-y-2 divide-ink overflow-hidden border-[3px] border-ink shadow-brut">
          {STATUS_COMPONENTS.map((c) => (
            <div key={c.name} className="flex items-start justify-between gap-4 bg-paper px-6 py-5">
              <div>
                <p className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">{c.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{c.description}</p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2 pt-1">
                <span className={`h-3 w-3 ${DOT[c.status]}`} aria-hidden />
                <span className="text-sm capitalize text-gray-600">{c.status}</span>
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-display text-2xl font-extrabold uppercase tracking-tight text-ink">
          Performance targets
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600">
          The service levels we design and monitor against.
        </p>
        <div className="mt-6 overflow-hidden border-[3px] border-ink shadow-brut">
          {PERF_TARGETS.map((t) => (
            <div key={t.metric} className="flex items-center justify-between gap-4 border-b-2 border-ink bg-paper px-6 py-4 last:border-b-0">
              <span className="text-sm text-gray-600">{t.metric}</span>
              <span className="font-display text-sm font-bold tabular-nums text-ink">{t.target}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t-2 border-ink pt-8 text-sm leading-relaxed text-gray-600">
          Live status is published here and to your dashboard. For an active incident,
          email{" "}
          <a className="text-ink underline underline-offset-4" href="mailto:contact@bookmycab.io">
            contact@bookmycab.io
          </a>
          .
        </p>
      </Container>
    </Section>
  );
}
