import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A coupon row (public.coupons, migration 0033). */
export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  percent_off: number;
  applies_to: "both" | "setup" | "subscription";
  max_redemptions: number | null;
  times_redeemed: number;
  active: boolean;
  expires_at: string | null;
};

export type CouponCheck =
  | { ok: true; coupon: Coupon }
  | { ok: false; error: string };

/** Lists all coupons, newest first (service-role client). */
export async function listCoupons(client: SupabaseClient): Promise<Coupon[]> {
  const { data, error } = await client
    .from("coupons")
    .select(
      "id, code, description, percent_off, applies_to, max_redemptions, times_redeemed, active, expires_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listCoupons failed", error);
    return [];
  }
  return (data ?? []) as Coupon[];
}

/** Normalises a user-entered coupon code (trimmed, upper-cased). */
export function normaliseCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Validates a coupon code against the catalog using the service-role client
 * (coupons is service-role-only; RLS default-denies everyone else). Checks the
 * coupon exists, is active, has not expired and has redemptions remaining.
 */
export async function validateCoupon(
  client: SupabaseClient,
  rawCode: string,
): Promise<CouponCheck> {
  const code = normaliseCouponCode(rawCode);
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const { data, error } = await client
    .from("coupons")
    .select(
      "id, code, description, percent_off, applies_to, max_redemptions, times_redeemed, active, expires_at",
    )
    .eq("code", code)
    .maybeSingle();

  if (error) return { ok: false, error: "Could not check that coupon." };
  if (!data) return { ok: false, error: "That coupon code was not found." };

  const coupon = data as Coupon;
  if (!coupon.active) return { ok: false, error: "That coupon is no longer active." };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "That coupon has expired." };
  }
  if (
    coupon.max_redemptions !== null &&
    coupon.times_redeemed >= coupon.max_redemptions
  ) {
    return { ok: false, error: "That coupon has reached its redemption limit." };
  }

  return { ok: true, coupon };
}

/** Applies a whole-number percentage discount, rounded to 2dp, never below 0. */
export function applyDiscount(amount: number, percentOff: number): number {
  const discounted = amount * (1 - percentOff / 100);
  return Math.max(0, Math.round(discounted * 100) / 100);
}

/**
 * Records a redemption (best-effort, non-atomic — fine for low-volume admin
 * provisioning). Returns false on failure so the caller can log it.
 */
export async function redeemCoupon(
  client: SupabaseClient,
  coupon: Pick<Coupon, "id" | "times_redeemed">,
): Promise<boolean> {
  const { error } = await client
    .from("coupons")
    .update({ times_redeemed: coupon.times_redeemed + 1 })
    .eq("id", coupon.id);
  return !error;
}
