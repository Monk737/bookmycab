"use server";

import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { CURRENCIES } from "@/lib/marketing/pricing";
import { PLAN_BANDS } from "@/lib/admin/plan-bands";

/** Form-state shape for the provisioning form (mirrors the auth AuthState). */
export type TenantFormState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
};

const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;

// Empty-string optional helper: turns "" into undefined so optional fields are
// not tripped by blank inputs.
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

const createTenantSchema = z.object({
  name: z.string().trim().min(1, "Org name is required."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers and single hyphens.",
    ),
  country: z.string().trim().min(1, "Country is required."),
  plan_band: z.enum(PLAN_BANDS),
  currency: z.enum(CURRENCIES),
  dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
  dispatch_company_id: optionalText,
  contact_email: z.string().trim().email("Enter a valid contact email."),
  contract_start: optionalText,
  // monthly_price: blank allowed (Custom may be quoted later); when present must be ≥ 0.
  monthly_price: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Monthly price must be a non-negative number.",
    })
    .optional(),
  stripe_customer_id: optionalText,
  // setup_fee amount → stored as a setup_fees row when provided.
  setup_fee: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Setup fee must be a non-negative number.",
    })
    .optional(),
});

/**
 * Provisions a new tenant.
 *
 * Defense-in-depth: re-checks staff access (middleware already gates /admin).
 * Validates with zod, inserts into `public.tenants` via the service-role client
 * (admin provisioning is cross-tenant; RLS would block a normal write), records
 * an audit entry, and—when a setup fee amount is supplied—inserts an unpaid
 * `setup_fees` row. On success redirects to the tenant detail page (Task 4).
 */
export async function createTenant(
  _prevState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const claims = await requireStaff();

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    country: formData.get("country"),
    plan_band: formData.get("plan_band"),
    currency: formData.get("currency"),
    dispatch_adapter: formData.get("dispatch_adapter"),
    dispatch_company_id: formData.get("dispatch_company_id"),
    contact_email: formData.get("contact_email"),
    contract_start: formData.get("contract_start"),
    monthly_price: formData.get("monthly_price"),
    stripe_customer_id: formData.get("stripe_customer_id"),
    setup_fee: formData.get("setup_fee"),
  };

  const parsed = createTenantSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const data = parsed.data;

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: inserted, error: insertError } = await serviceClient
    .from("tenants")
    .insert({
      name: data.name,
      slug: data.slug,
      country: data.country,
      plan_band: data.plan_band,
      currency: data.currency,
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email,
      stripe_customer_id: data.stripe_customer_id ?? null,
      contract_start: data.contract_start ?? null,
      monthly_price: data.monthly_price ?? null,
      status: "onboarding",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // 23505 = unique_violation; only treat it as a slug clash when the failing
    // constraint actually references slug (otherwise surface a generic error).
    const isDuplicateSlug =
      insertError?.code === "23505" &&
      (insertError.message?.includes("slug") ||
        insertError.details?.includes("slug"));
    return {
      fieldErrors: isDuplicateSlug
        ? { slug: ["That slug is already taken."] }
        : {},
      formError: isDuplicateSlug
        ? null
        : "Could not create the tenant. Please try again.",
    };
  }

  const tenantId = inserted.id as string;

  // Capture the setup fee as an unpaid setup_fees row when an amount is given.
  if (data.setup_fee !== undefined) {
    const { error: feeError } = await serviceClient.from("setup_fees").insert({
      tenant_id: tenantId,
      amount: data.setup_fee,
      currency: data.currency,
      paid_at: null,
    });
    if (feeError) {
      console.error("createTenant: failed to record setup fee", feeError);
    }
  }

  // Audit the provisioning action against the acting staff user. `requireStaff`
  // guarantees `claims` is non-null, so the audit always fires after a
  // successful insert.
  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.create",
    targetType: "tenant",
    targetId: tenantId,
    metadata: {
      name: data.name,
      plan_band: data.plan_band,
      currency: data.currency,
    },
  });
  if (!audited) {
    console.error("audit write failed for tenant.create", { tenantId });
  }

  redirect(`/admin/tenants/${tenantId}`);
}
