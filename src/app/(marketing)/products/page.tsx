import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { TryDashboardLink } from "@/components/marketing/try-dashboard-link";
import { DispatchBadges } from "@/components/marketing/dispatch-badges";
import { ChannelConvergence } from "@/components/marketing/channel-convergence";
import { PRODUCTS, ProductIcon } from "@/components/marketing/product-marks";
import { Reveal } from "@/components/marketing/reveal";
import { CommandCentre } from "@/components/marketing/command-centre";

export const metadata: Metadata = {
  title: "Products · BookMyCab",
  description:
    "Two products on one automation: an AI voice agent that answers your phone and a WhatsApp bot that takes bookings by chat. Both quote, confirm and book into AutoCab, iCabbi or Cordic. You own your numbers and your customers.",
};

// The two products, voice first. Each gets a substantial block, not an
// identical card; voice leads because the phone is where most fares are lost.
const PRODUCT_DETAIL = [
  {
    short: "AI Voice",
    accent: "bg-brut-yellow",
    medium: "On your phone line",
    lead: "An AI agent answers your booking line on the first ring, speaks naturally in a British voice under your firm's name, and takes the whole booking by talking. No hold music, no queue, no voicemail nobody returns.",
    points: [
      ["Picks up day and night", "Every call answered on the first ring, at 3am and on your busiest Saturday alike. No call left ringing out to a rival."],
      ["Takes the booking by voice", "Pickup, destination, time and vehicle captured in a normal conversation. It asks only what it has to, then reads the fare back out loud."],
      ["Covers overflow and after-hours", "When the office line is jammed or the desk is dark, the agent picks up the calls your team can't. Nothing spills to the firm down the road."],
      ["Logged to your dashboard", "Every call is transcribed, scored and saved against the customer, so you can see exactly what was said and what it booked."],
    ],
  },
  {
    short: "WhatsApp",
    accent: "bg-brut-cyan",
    medium: "On WhatsApp Business",
    lead: "The app most of your customers already message you on. A typed line or a ten-second voice note both become confirmed bookings, quoted and written into dispatch without anyone at the desk picking up.",
    points: [
      ["Text or voice note", "A quick-reply tap, a typed address or a voice note from a noisy street all turn into the same clean booking."],
      ["Quotes and confirms in chat", "Your fare shown, one tap to confirm, the job in dispatch, all inside the conversation the customer started."],
      ["One history with the calls", "A customer who phones one week and messages the next is one record to you, not two threads to stitch together."],
    ],
  },
] as const;

export default function ProductsPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-10 pt-12 sm:pb-14 sm:pt-16">
        <Container className="max-w-3xl rise-group">
          <Badge>Products</Badge>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl xl:text-7xl">
            Two products.{" "}
            <span className="box-decoration-clone bg-brut-yellow px-2 text-ink ring-2 ring-ink">
              One automation
            </span>
            .
          </h1>
          <p className="mt-7 text-lg leading-relaxed text-gray-600 sm:text-xl">
            An AI voice agent on your phone line and a bot on WhatsApp. Both take
            the booking, quote your fare, confirm the trip and write the job
            straight into your dispatch. One automation runs behind them, with no
            extra logins for your team.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
        </Container>
      </Section>

      {/* Signature, convergence visual (two-into-one). */}
      <Section className="pb-16 pt-4 sm:pb-24">
        <Container>
          <ChannelConvergence />
        </Container>
      </Section>

      {/* Per-product detail, two substantial blocks, voice first. */}
      <Section className="border-t-[3px] border-ink py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              What each product does for you
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Same automation, same dispatch, met wherever the customer reaches
              for you first, the phone or WhatsApp.
            </p>
          </div>

          <Reveal as="div" className="mt-12 space-y-9 lg:space-y-12">
            {PRODUCT_DETAIL.map((detail, idx) => {
              const mark = PRODUCTS.find((p) => p.short === detail.short)!;
              const flip = idx % 2 === 1; // alternate the identity panel left/right
              return (
                <section
                  key={detail.short}
                  className="grid items-stretch gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl lg:grid-cols-[minmax(0,23rem)_1fr]"
                >
                  {/* Identity panel: the product's own colour carries it. */}
                  <div
                    className={`flex flex-col justify-between ${detail.accent} p-7 sm:p-9 ${
                      flip ? "lg:order-2" : ""
                    }`}
                  >
                    <div>
                      <span className="inline-flex items-center gap-2 border-2 border-ink bg-paper px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                        {detail.medium}
                      </span>
                      <div className="mt-6 flex items-center gap-3.5">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-ink bg-paper">
                          <ProductIcon mark={mark} className="h-12 w-12" />
                        </span>
                        <h3 className="font-display text-2xl font-extrabold uppercase leading-[0.95] tracking-tight text-accent-ink sm:text-[1.7rem]">
                          {mark.name}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-7 text-[15px] leading-relaxed text-accent-ink/85">
                      {detail.lead}
                    </p>
                  </div>

                  {/* Capability grid: shared hairlines, not floating cards. */}
                  <div
                    className={`grid bg-ink gap-[3px] sm:grid-cols-2 ${flip ? "lg:order-1" : ""}`}
                  >
                    {detail.points.map(([k, v], i) => {
                      const wide =
                        detail.points.length % 2 === 1 && i === detail.points.length - 1;
                      return (
                        <div
                          key={k}
                          className={`flex flex-col bg-paper p-6 ${wide ? "sm:col-span-2" : ""}`}
                        >
                          <p className="font-display text-base font-extrabold uppercase leading-tight tracking-tight text-ink">
                            {k}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-gray-600">{v}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </Reveal>
        </Container>
      </Section>

      {/* One dashboard behind both products — the operator's view. */}
      <Section className="border-t-[3px] border-ink bg-canvas py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 border-2 border-ink bg-brut-cyan px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-ink">
              One dashboard, both products
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Everything it does, on one screen
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              Calls and WhatsApp report into the same dashboard, against the same
              customers. No reports to pull, nothing for your team to fill in.
              Open it between jobs and the week reads itself back to you.
            </p>
          </div>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,30rem)_1fr] lg:gap-14">
            <CommandCentre />

            <div>
              <ul className="grid gap-[3px] overflow-hidden border-[3px] border-ink bg-ink shadow-brut">
                {[
                  ["Live activity", "Every call transcribed and every WhatsApp saved, both against one customer record. Search a name, filter to a day, open any job and read what was said."],
                  ["Booking intelligence", "Know your demand cold: revenue and average fare, the busiest hours and days to staff for, top routes and airport runs, vehicle mix, voice-note against typed bookings, and the fares the agent chased back, in pounds."],
                  ["Agent quality", "Every call graded for caller mood and outcome. The ones worth a listen surface on their own, and the agent suggests its own script tweaks."],
                  ["The Monday briefing", "A plain-English read of your week, written fresh every Monday: what changed, what cost you bookings, and one fix to try."],
                ].map(([k, v]) => (
                  <li key={k} className="bg-paper p-5 sm:p-6">
                    <p className="font-display text-base font-extrabold uppercase leading-tight tracking-tight text-ink">
                      {k}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{v}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <TryDashboardLink size="lg" label="See the live demo dashboard" />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Customer-owned credentials, committed amber band. */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="border-[3px] border-ink bg-brut-yellow shadow-brut-xl px-7 py-12 sm:px-12 sm:py-16">
            <h2 className="text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-accent-ink sm:text-4xl">
              Your number. Your accounts. Your data.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-accent-ink/80">
              You connect your own phone number and WhatsApp Business account;
              AI processing and voice calling minutes are included in your plan.
              You pay only your number and WhatsApp conversation fees directly,
              at provider price. Every rider and account stays on your books, and
              nothing is ever held hostage.
            </p>
          </div>
        </Container>
      </Section>

      {/* Dispatch integrations */}
      <Section className="py-16 sm:py-24">
        <Container>
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
              Books straight into your dispatch
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Whether the booking comes in by call or by WhatsApp, it lands
              directly in the dispatch system you already run.
            </p>
          </div>
          <div className="mt-8">
            <DispatchBadges />
          </div>
        </Container>
      </Section>

      {/* Closing CTA band, homepage parity. */}
      <Section className="pb-20 pt-4 sm:pb-28">
        <Container>
          <div className="border-[3px] border-ink bg-ink px-7 py-16 text-center shadow-brut-xl sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-paper sm:text-5xl">
              Let&apos;s wire up your line and WhatsApp
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-gray-300">
              Book a discovery call and we will point your booking number at the
              voice agent and connect your WhatsApp, both on one automation.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <DiscoveryCta size="lg" />
              <Link
                href="/how-it-works"
                className="inline-flex h-12 items-center justify-center brut-press brut-focus border-[3px] border-paper bg-ink px-7 text-base font-bold uppercase tracking-[0.04em] text-paper shadow-[4px_4px_0_0_#ffffff]"
              >
                See how it works
              </Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
