import { requireStaff } from "@/lib/admin/guard";
import { listPlans, listFeatures, listPlanFeatures } from "@/lib/admin/entitlements";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  VOICE_PLAN_SPEC,
  DOUBLE_DECKER_GBP,
  NEW_CHAT_SETUP_GBP,
  NEW_VOICE_SETUP_GBP,
  NEW_BUNDLE_SETUP_GBP,
  type NewTierKey,
} from "@/lib/billing/pricing";
import { CREDIT_UNIT_GBP, MIN_TOPUP_GBP } from "@/lib/billing/credit";
import { togglePlanFeature } from "./actions";

export const metadata = { title: "Plans, Admin" };

const TIERS: NewTierKey[] = ["ignition", "in_motion", "full_throttle"];
const TIER_LABEL: Record<NewTierKey, string> = {
  ignition: "Ignition",
  in_motion: "In Motion",
  full_throttle: "Full Throttle",
};

/** GBP whole-pound formatter; `null` renders as a quoted dash. */
function gbp(n: number | null): string {
  return n == null ? "Quoted" : `£${n.toLocaleString("en-GB")}`;
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">{children}</h2>
      {sub ? <p className="mt-0.5 text-sm text-gray-600">{sub}</p> : null}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 font-bold uppercase tracking-[0.04em] text-gray-700 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return (
    <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-mono font-bold text-ink" : "text-gray-700"}`}>
      {children}
    </td>
  );
}

function CatalogCard({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className={`flex items-center gap-2 border-b-[3px] border-ink ${accent} px-4 py-2.5`}>
        <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">{title}</h3>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export default async function PlansPage() {
  await requireStaff();
  const [plans, features] = await Promise.all([listPlans(), listFeatures()]);
  const planFeatures = await Promise.all(plans.map((p) => listPlanFeatures(p.id)));
  const enabledSet = plans.map((_, i) => new Set(planFeatures[i].filter((f) => f.enabled).map((f) => f.feature_key)));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">Plans &amp; pricing</h1>
        <p className="mt-1 text-sm text-gray-600">
          The two-product commercial catalogue (GBP, rolling monthly). These are the list prices
          provisioning charges; coupons discount them at tenant creation.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Chat */}
        <CatalogCard accent="bg-brut-cyan" title="Chat — multi-channel booking bot">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr><Th>Tier</Th><Th right>Single channel</Th><Th right>Channel bundle</Th><Th right>Setup (one-time)</Th></tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {TIERS.map((t) => (
                <tr key={t}>
                  <Td strong>{TIER_LABEL[t]}</Td>
                  <Td right>{gbp(CHAT_PRICE_GBP[t].single)}</Td>
                  <Td right>{gbp(CHAT_PRICE_GBP[t].bundle)}</Td>
                  <Td right>{gbp(NEW_CHAT_SETUP_GBP)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t-2 border-gray-100 px-3 py-2 text-xs text-gray-500">
            Single = one channel (e.g. WhatsApp). Bundle = all channels (WhatsApp, Messenger, Instagram, Telegram, web widget).
            Full Throttle is individually quoted.
          </p>
        </CatalogCard>

        {/* Voice */}
        <CatalogCard accent="bg-brut-violet" title="AI Voice — phone booking agent">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Tier</Th><Th right>Monthly</Th><Th right>Calls / mo</Th><Th right>Agents</Th>
                <Th right>Setup 1 agent</Th><Th right>Setup 2 agents</Th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {TIERS.map((t) => (
                <tr key={t}>
                  <Td strong>{TIER_LABEL[t]}</Td>
                  <Td right>{gbp(VOICE_PRICE_GBP[t])}</Td>
                  <Td right>{VOICE_PLAN_SPEC[t].callAllowance.toLocaleString("en-GB")}</Td>
                  <Td right>{VOICE_PLAN_SPEC[t].includedAgents}</Td>
                  <Td right>{gbp(NEW_VOICE_SETUP_GBP.oneAgent)}</Td>
                  <Td right>{gbp(NEW_VOICE_SETUP_GBP.twoAgents)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t-2 border-gray-100 px-3 py-2 text-xs text-gray-500">
            Plan calls reset each billing month (no carry-over). Extra calls draw from prepaid credit at{" "}
            <span className="font-mono font-bold text-ink">£{CREDIT_UNIT_GBP.toFixed(2)}</span>/call,
            minimum top-up <span className="font-mono font-bold text-ink">£{MIN_TOPUP_GBP}</span>. Second agent add-on:{" "}
            <span className="font-mono font-bold text-ink">{gbp(NEW_VOICE_SETUP_GBP.secondAgentAddOn)}</span> setup.
          </p>
        </CatalogCard>

        {/* Double Decker */}
        <CatalogCard accent="bg-brut-yellow" title="Double Decker — Chat + AI Voice bundle">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Tier</Th><Th>Chat mode</Th><Th right>Bundle total</Th>
                <Th right>Chat split</Th><Th right>Voice split</Th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {TIERS.map((t) =>
                (["single", "bundle"] as const).map((mode) => {
                  const s = DOUBLE_DECKER_GBP[t][mode];
                  return (
                    <tr key={`${t}-${mode}`}>
                      <Td strong>{TIER_LABEL[t]}</Td>
                      <Td>{mode === "single" ? "Single channel" : "Channel bundle"}</Td>
                      <Td right strong>{gbp(s.total)}</Td>
                      <Td right>{gbp(s.chat)}</Td>
                      <Td right>{gbp(s.voice)}</Td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
          <p className="border-t-2 border-gray-100 px-3 py-2 text-xs text-gray-500">
            Billed as two Stripe subscriptions (chat + voice) that sum to the bundle total. Setup:{" "}
            <span className="font-mono font-bold text-ink">{gbp(NEW_BUNDLE_SETUP_GBP.oneVoiceAgent)}</span> (1 voice agent) /{" "}
            <span className="font-mono font-bold text-ink">{gbp(NEW_BUNDLE_SETUP_GBP.twoVoiceAgents)}</span> (2 voice agents).
          </p>
        </CatalogCard>

        {/* Feature packaging (entitlements) */}
        <section>
          <SectionTitle sub="Toggles drive entitlements (e.g. the metered voice_calls pool) and feature gating per plan.">
            Feature packaging
          </SectionTitle>
          <div className="overflow-x-auto border-[3px] border-ink bg-paper shadow-brut">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-gray-700">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className="px-3 py-2 text-center font-bold text-gray-700">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100">
                {features.map((f) => (
                  <tr key={f.key}>
                    <td className="px-3 py-2 text-gray-800">
                      {f.name}
                      {f.metered ? <span className="ml-1.5 border border-ink bg-brut-yellow px-1 py-0.5 text-[10px] font-bold uppercase text-ink">metered</span> : null}
                    </td>
                    {plans.map((p, i) => {
                      const on = enabledSet[i].has(f.key);
                      return (
                        <td key={p.id} className="px-3 py-2 text-center">
                          <form action={togglePlanFeature} className="inline">
                            <input type="hidden" name="planId" value={p.id} />
                            <input type="hidden" name="featureKey" value={f.key} />
                            <input type="hidden" name="enabled" value={(!on).toString()} />
                            <button
                              type="submit"
                              className={`cursor-pointer border-2 border-ink px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em] ${on ? "bg-brut-lime text-ink" : "bg-gray-100 text-gray-400"}`}
                            >
                              {on ? "On" : "Off"}
                            </button>
                          </form>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
