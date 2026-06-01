import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { COMPANY } from "@/lib/marketing/nav";

// TEMPORARY Home placeholder — replaced by Task 3.
export default function Home() {
  return (
    <Section>
      <Container className="max-w-3xl text-center">
        <Badge>{COMPANY.product}</Badge>
        <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
          {COMPANY.tagline}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-600">
          Bespoke AI booking and support automations for cab companies — built
          around your fleet, your numbers, your customers.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <DiscoveryCta size="lg" />
          <TryDashboardLink size="lg" />
        </div>
      </Container>
    </Section>
  );
}
