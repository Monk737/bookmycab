"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { normaliseCouponCode } from "@/lib/admin/coupons";

export type CouponFormState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
  ok?: boolean;
};

function db() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters.")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9-]*$/,
      "Code may use letters, numbers and hyphens only.",
    ),
  description: optionalText,
  percent_off: z
    .string()
    .trim()
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100, {
      message: "Percent off must be a whole number from 1 to 100.",
    }),
  applies_to: z.enum(["both", "setup", "subscription"]),
  max_redemptions: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
      message: "Max redemptions must be a positive whole number (or blank for unlimited).",
    })
    .optional(),
  expires_at: optionalText, // yyyy-mm-dd from a date input
});

/** Creates a coupon. Code is stored upper-cased; unique-violation → field error. */
export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  const claims = await requireStaff();

  const parsed = createCouponSchema.safeParse({
    code: formData.get("code"),
    description: formData.get("description"),
    percent_off: formData.get("percent_off"),
    applies_to: formData.get("applies_to"),
    max_redemptions: formData.get("max_redemptions"),
    expires_at: formData.get("expires_at"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const d = parsed.data;
  const code = normaliseCouponCode(d.code);

  const { data: inserted, error } = await db()
    .from("coupons")
    .insert({
      code,
      description: d.description ?? null,
      percent_off: d.percent_off,
      applies_to: d.applies_to,
      max_redemptions: d.max_redemptions ?? null,
      // a bare date becomes end-of-day UTC so a same-day coupon is still valid
      expires_at: d.expires_at ? `${d.expires_at}T23:59:59Z` : null,
      created_by: claims.sub,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    const dup = error?.code === "23505";
    return {
      fieldErrors: dup ? { code: ["That coupon code already exists."] } : {},
      formError: dup ? null : "Could not create the coupon. Please try again.",
    };
  }

  await writeAudit({
    actorUserId: claims.sub,
    action: "coupon.create",
    targetType: "coupon",
    targetId: inserted.id as string,
    metadata: { code, percent_off: d.percent_off, applies_to: d.applies_to },
  });

  revalidatePath("/admin/coupons");
  return { fieldErrors: {}, formError: null, ok: true };
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

/** Activates / deactivates a coupon. */
export async function toggleCoupon(formData: FormData): Promise<void> {
  const claims = await requireStaff();
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;

  const nextActive = parsed.data.active === "true";
  const { error } = await db()
    .from("coupons")
    .update({ active: nextActive })
    .eq("id", parsed.data.id);
  if (error) {
    console.error("toggleCoupon failed", error);
    return;
  }

  await writeAudit({
    actorUserId: claims.sub,
    action: nextActive ? "coupon.activate" : "coupon.deactivate",
    targetType: "coupon",
    targetId: parsed.data.id,
    metadata: {},
  });

  revalidatePath("/admin/coupons");
}
