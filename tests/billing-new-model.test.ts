import { describe, it, expect } from "vitest";
import { buildProvisioningRows, createTenantSchema } from "@/app/admin/tenants/provisioning";

const baseForm = {
  name: "Speedy Cabs", slug: "speedy-cabs", country: "GB",
  contact_email: "owner@speedy.co.uk", dispatch_adapter: "autocab",
  plan_type: "voice_ignition",
};

describe("createTenantSchema", () => {
  it("accepts a base voice_ignition tenant", () => {
    expect(createTenantSchema.safeParse(baseForm).success).toBe(true);
  });
  it("requires custom fields when plan_type=custom", () => {
    const r = createTenantSchema.safeParse({ ...baseForm, plan_type: "custom" });
    expect(r.success).toBe(false);
  });
  it("accepts a full custom plan", () => {
    const r = createTenantSchema.safeParse({
      ...baseForm, plan_type: "custom",
      custom_plan_name: "Airport Pack", custom_billing_mode: "recurring",
      custom_includes_voice: "on", custom_call_allowance: "5000",
      custom_included_agents: "3", custom_plan_price_gbp: "4500",
      custom_setup_fee_gbp: "1500", custom_validity_days: "30",
      custom_extra_credit_price_gbp: "0.75",
    });
    expect(r.success).toBe(true);
  });
});

describe("buildProvisioningRows", () => {
  it("whatsapp_suite: chat row £499, no voice, setup £999, model=chat", () => {
    const rows = buildProvisioningRows({
      data: createTenantSchema.parse({ ...baseForm, plan_type: "whatsapp_suite" }),
      discountPercent: 0, bypass: false,
    });
    expect(rows.tenant.commercial_model).toBe("chat");
    expect(rows.tenant.plan_type).toBe("whatsapp_suite");
    expect(rows.tenant.monthly_price).toBe(499);
    expect(rows.chat).toEqual({ plan_tier: "ignition", monthly_price_gbp: 499 });
    expect(rows.voice).toBeNull();
    expect(rows.custom).toBeNull();
    expect(rows.setupGbp).toBe(999);
  });

  it("voice_ignition: voice row 1000 calls £1999, setup £999, model=voice", () => {
    const rows = buildProvisioningRows({
      data: createTenantSchema.parse(baseForm), discountPercent: 0, bypass: false,
    });
    expect(rows.tenant.commercial_model).toBe("voice");
    expect(rows.voice).toEqual({
      plan_tier: "ignition", monthly_price_gbp: 1999,
      monthly_call_allowance: 1000, included_agents: 1,
    });
    expect(rows.chat).toBeNull();
    expect(rows.setupGbp).toBe(999);
  });

  it("custom recurring voice: custom row + voice row (plan_tier custom) + model=custom", () => {
    const data = createTenantSchema.parse({
      ...baseForm, plan_type: "custom",
      custom_plan_name: "Airport Pack", custom_billing_mode: "recurring",
      custom_includes_voice: "on", custom_call_allowance: "5000",
      custom_included_agents: "3", custom_plan_price_gbp: "4500",
      custom_setup_fee_gbp: "1500", custom_validity_days: "30",
      custom_extra_credit_price_gbp: "0.75",
    });
    const rows = buildProvisioningRows({ data, discountPercent: 0, bypass: false });
    expect(rows.tenant.commercial_model).toBe("custom");
    expect(rows.tenant.plan_type).toBe("custom");
    expect(rows.tenant.monthly_price).toBe(4500);
    expect(rows.voice).toEqual({
      plan_tier: "custom", monthly_price_gbp: 4500,
      monthly_call_allowance: 5000, included_agents: 3,
    });
    expect(rows.custom).toMatchObject({
      plan_name: "Airport Pack", billing_mode: "recurring",
      monthly_call_allowance: 5000, included_agents: 3,
      plan_price_gbp: 4500, setup_fee_gbp: 1500, validity_days: 30,
      extra_credit_price_gbp: 0.75, includes_voice: true, includes_chat: false,
    });
    expect(rows.setupGbp).toBe(1500);
  });

  it("100%-off bypass zeroes every price", () => {
    const rows = buildProvisioningRows({
      data: createTenantSchema.parse(baseForm), discountPercent: 100, bypass: true,
    });
    expect(rows.tenant.monthly_price).toBe(0);
    expect(rows.voice?.monthly_price_gbp).toBe(0);
    expect(rows.setupGbp).toBe(0);
    expect(rows.tenant.status).toBe("active");
  });
});
