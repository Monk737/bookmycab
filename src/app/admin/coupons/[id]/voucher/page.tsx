import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import type { Coupon } from "@/lib/admin/coupons";
import { PrintButton } from "./print-button";

export const metadata = { title: "Voucher, Admin", robots: { index: false, follow: false } };

const APPLIES_LABEL: Record<string, string> = {
  both: "Setup fee + first subscription",
  setup: "Setup fee only",
  subscription: "Subscription only",
};

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No expiry";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Printable discount voucher for a single coupon. Staff-gated (requireStaff).
 * The admin sidebar carries `print:hidden`, so printing this page yields just
 * the voucher card. Hand or email the printout to a prospective tenant.
 */
export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const client = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await client
    .from("coupons")
    .select("id, code, description, percent_off, applies_to, max_redemptions, times_redeemed, active, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const c = data as Coupon;
  const remaining = c.max_redemptions == null ? null : Math.max(0, c.max_redemptions - c.times_redeemed);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Toolbar — not printed. */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/coupons"
          className="text-xs font-bold uppercase tracking-[0.06em] text-ink underline decoration-2 underline-offset-4 hover:bg-brut-cyan"
        >
          ← Back to coupons
        </Link>
        <PrintButton />
      </div>

      {/* The voucher itself. */}
      <article className="border-[3px] border-ink bg-paper shadow-brut print:shadow-none">
        <header className="flex items-center justify-between gap-3 border-b-[3px] border-ink bg-ink px-7 py-5 text-paper print:bg-ink">
          <span className="inline-flex items-center gap-1.5 font-logo text-base leading-none tracking-tight">
            BookMyCab
            <span aria-hidden="true" className="inline-block h-3 w-3 border-2 border-paper bg-brut-yellow" />
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300">Discount voucher</span>
        </header>

        <div className="px-7 py-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Save</p>
          <p className="mt-1 font-display text-7xl font-extrabold leading-none tracking-[-0.03em] text-ink">
            {c.percent_off}%
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-700">off your {APPLIES_LABEL[c.applies_to]?.toLowerCase() ?? c.applies_to}</p>

          {c.description ? (
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-600">{c.description}</p>
          ) : null}

          <div className="mx-auto mt-7 inline-block border-[3px] border-dashed border-ink bg-brut-yellow px-8 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/70">Coupon code</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.12em] text-ink">{c.code}</p>
          </div>

          {c.percent_off === 100 ? (
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-ink">
              Comps setup + subscription in full — no card required
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-[3px] border-t-[3px] border-ink bg-ink">
          {[
            { label: "Applies to", value: APPLIES_LABEL[c.applies_to] ?? c.applies_to },
            { label: "Expires", value: formatExpiry(c.expires_at) },
            { label: "Redemptions left", value: remaining == null ? "Unlimited" : String(remaining) },
          ].map((f) => (
            <div key={f.label} className="bg-paper px-4 py-3 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">{f.label}</dt>
              <dd className="mt-1 text-sm font-bold text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>

        <footer className="border-t-[3px] border-ink px-7 py-4 text-center">
          <p className="text-[11px] leading-relaxed text-gray-500">
            Redeemable once per organisation at provisioning. Quote this code to your BookMyCab contact.
            Not transferable for cash. BookMyCab by FlowMo AI LTD.
          </p>
        </footer>
      </article>
    </div>
  );
}
