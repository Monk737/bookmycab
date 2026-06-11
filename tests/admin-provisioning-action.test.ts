import { describe, it, expect } from "vitest";
import {
  createTenantSchema,
  buildProvisioningRows,
} from "@/app/admin/tenants/actions";

const base = {
  name: "Speedy Cabs",
  slug: "speedy-cabs",
  country: "GB",
  contact_email: "ops@speedy.example",
  dispatch_adapter: "autocab",
} as const;

describe("createTenantSchema", () => {
  it("accepts a valid double_decker selection", () => {
    const r = createTenantSchema.safeParse({
      ...base, commercial_model: "double_decker",
      chat_tier: "in_motion", chat_channel_mode: "bundle", voice_tier: "in_motion",
    });
    expect(r.success).toBe(true);
  });
  it("requires chat fields when model includes chat", () => {
    const r = createTenantSchema.safeParse({ ...base, commercial_model: "chat" });
    expect(r.success).toBe(false);
  });
  it("requires a manual chat price for full_throttle chat", () => {
    const r = createTenantSchema.safeParse({
      ...base, commercial_model: "chat", chat_tier: "full_throttle", chat_channel_mode: "single",
    });
    expect(r.success).toBe(false); // chat_price_override required
  });
});

describe("buildProvisioningRows", () => {
  it("double_decker → tenant + chat + voice rows with discounted GBP", () => {
    const out = buildProvisioningRows({
      data: {
        ...base, commercial_model: "double_decker",
        chat_tier: "in_motion", chat_channel_mode: "bundle", voice_tier: "in_motion",
        chat_price_override: undefined, coupon_code: undefined,
      },
      discountPercent: 10,
      bypass: false,
    });
    // 10% off: chat 1600→1440, voice 1599→1439.1, setup 2000→1800
    expect(out.tenant.commercial_model).toBe("double_decker");
    expect(out.tenant.currency).toBe("GBP");
    expect(out.tenant.plan_band).toBeNull();
    expect(out.tenant.status).toBe("onboarding");
    expect(out.chat?.monthly_price_gbp).toBeCloseTo(1440, 2);
    expect(out.chat?.channel_mode).toBe("bundle");
    expect(out.voice?.monthly_price_gbp).toBeCloseTo(1439.1, 2);
    expect(out.voice?.monthly_call_allowance).toBe(2250);
    expect(out.voice?.included_agents).toBe(2);
    expect(out.setupGbp).toBeCloseTo(1800, 2);
  });
  it("voice-only → no chat row", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "voice", voice_tier: "ignition",
        chat_tier: undefined, chat_channel_mode: undefined, chat_price_override: undefined, coupon_code: undefined },
      discountPercent: 0, bypass: false,
    });
    expect(out.chat).toBeNull();
    expect(out.voice?.monthly_price_gbp).toBe(1199);
  });
  it("bypass (100%-off) → zero prices, status active", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "chat", chat_tier: "ignition", chat_channel_mode: "single",
        voice_tier: undefined, chat_price_override: undefined, coupon_code: "FREE" },
      discountPercent: 100, bypass: true,
    });
    expect(out.tenant.status).toBe("active");
    expect(out.tenant.billing_bypass).toBe(true);
    expect(out.chat?.monthly_price_gbp).toBe(0);
    expect(out.setupGbp).toBe(0);
  });
});
