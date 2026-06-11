import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { listCoupons } from "@/lib/admin/coupons";
import { CouponForm } from "./coupon-form";
import { toggleCoupon } from "./actions";

export const metadata = { title: "Coupons, Admin" };

const APPLIES_LABEL: Record<string, string> = {
  both: "Setup + subscription",
  setup: "Setup fee only",
  subscription: "Subscription only",
};

export default async function CouponsPage() {
  await requireStaff();
  const client = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const coupons = await listCoupons(client);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">
          Discount coupons
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Apply a coupon when provisioning a tenant. A 100%-off code comps the
          setup fee and subscription and bypasses Stripe payment entirely.
        </p>
      </div>

      <CouponForm />

      <div className="overflow-x-auto border-[3px] border-ink">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Code", "Off", "Applies to", "Redemptions", "Expires", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No coupons yet. Create one above.
                </td>
              </tr>
            )}
            {coupons.map((c) => {
              const expired = c.expires_at !== null && new Date(c.expires_at).getTime() < Date.now();
              const usedUp = c.max_redemptions !== null && c.times_redeemed >= c.max_redemptions;
              const live = c.active && !expired && !usedUp;
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono font-bold text-ink">
                    {c.code}
                    {c.percent_off === 100 && (
                      <span className="ml-2 border border-ink bg-brut-yellow px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">
                        Stripe bypass
                      </span>
                    )}
                    {c.description && <p className="font-sans text-xs font-normal text-gray-500">{c.description}</p>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink">{c.percent_off}%</td>
                  <td className="px-3 py-2 text-gray-700">{APPLIES_LABEL[c.applies_to] ?? c.applies_to}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700">
                    {c.times_redeemed}
                    {c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {live ? (
                      <span className="border border-ink bg-brut-lime/40 px-2 py-0.5 text-xs font-medium text-ink">Active</span>
                    ) : (
                      <span className="border border-ink bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        {expired ? "Expired" : usedUp ? "Used up" : "Inactive"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/admin/coupons/${c.id}/voucher`}
                        className="cursor-pointer border-2 border-ink bg-brut-cyan px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-ink transition-colors hover:bg-brut-cyan/80"
                      >
                        Voucher
                      </a>
                      <form action={toggleCoupon} className="inline">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={(!c.active).toString()} />
                        <button
                          type="submit"
                          className="cursor-pointer border-2 border-ink px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-gray-100"
                        >
                          {c.active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
