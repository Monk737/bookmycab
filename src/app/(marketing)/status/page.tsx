import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import {
  STATUS_COMPONENTS, PERF_TARGETS, STATUS_LABEL, overallStatus,
  type ComponentStatus,
} from "@/lib/marketing/status";

export const metadata: Metadata = {
  title: "Status — BookMyCab",
  description:
    "Live operational status of the BookMyCab platform — dashboard, gateway, automation engine, dispatch and data — plus the performance targets we hold ourselves to.",
};

const DOT: Record<ComponentStatus, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  outage: "bg-red-500",
};

export default function StatusPage() {
  const overall = overallStatus(STATUS_COMPONENTS);

  return (
    <Section className="pb-14 sm:pb-20">
      <Container className="max-w-3xl">
        <Badge>Status</Badge>
        <h1 className="mt-6 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          Platform status
        </h1>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5">
          <span className={`h-3 w-3 flex-shrink-0 rounded-full ${DOT[overall]}`} aria-hidden />
          <p className="text-base font-medium text-ink">{STATUS_LABEL[overall]}</p>
        </div>

        <div className="mt-10 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
          {STATUS_COMPONENTS.map((c) => (
            <div key={c.name} className="flex items-start justify-between gap-4 bg-paper px-6 py-5">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{c.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{c.description}</p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2 pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[c.status]}`} aria-hidden />
                <span className="text-sm capitalize text-gray-600">{c.status}</span>
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-tight text-ink">
          Performance targets
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600">
          The service levels we design and monitor against.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
          {PERF_TARGETS.map((t) => (
            <div key={t.metric} className="flex items-center justify-between gap-4 border-b border-gray-100 bg-paper px-6 py-4 last:border-b-0">
              <span className="text-sm text-gray-600">{t.metric}</span>
              <span className="font-display text-sm font-semibold tabular-nums text-ink">{t.target}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t border-gray-200 pt-8 text-sm leading-relaxed text-gray-500">
          Live status is published here and to your dashboard. For an active incident,
          email{" "}
          <a className="text-ink underline underline-offset-4" href="mailto:hello@bookmycab.com">
            hello@bookmycab.com
          </a>
          .
        </p>
      </Container>
    </Section>
  );
}
