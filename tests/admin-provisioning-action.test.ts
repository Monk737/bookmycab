import { describe, it, expect } from "vitest";
import {
  createTenantSchema,
  buildProvisioningRows,
} from "@/app/admin/tenants/provisioning";

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
      chat_tier: "in_motion", voice_tier: "in_motion",
    });
    expect(r.success).toBe(true);
  });
  it("requires a chat tier when model includes chat", () => {
    const r = createTenantSchema.safeParse({ ...base, commercial_model: "chat" });
    expect(r.success).toBe(false);
  });
  it("requires a voice tier when model includes voice", () => {
    const r = createTenantSchema.safeParse({ ...base, commercial_model: "voice" });
    expect(r.success).toBe(false);
  });
  it("accepts chat full_throttle without any override (now list-priced)", () => {
    const r = createTenantSchema.safeParse({
      ...base, commercial_model: "chat", chat_tier: "full_throttle",
    });
    expect(r.success).toBe(true);
  });
});

describe("buildProvisioningRows", () => {
  it("double_decker → tenant + chat + voice rows with discounted GBP", () => {
    const out = buildProvisioningRows({
      data: {
        ...base, commercial_model: "double_decker",
        chat_tier: "in_motion", voice_tier: "in_motion", coupon_code: undefined,
      },
      discountPercent: 10,
      bypass: false,
    });
    // bundle chat 799, voice 1799; 10% off → 719.1 / 1619.1, setup 2000 → 1800
    expect(out.tenant.commercial_model).toBe("double_decker");
    expect(out.tenant.currency).toBe("GBP");
    expect(out.tenant.status).toBe("onboarding");
    expect(out.chat?.monthly_price_gbp).toBeCloseTo(719.1, 2);
    expect(out.voice?.monthly_price_gbp).toBeCloseTo(1619.1, 2);
    expect(out.voice?.monthly_call_allowance).toBe(2250);
    expect(out.voice?.included_agents).toBe(2);
    expect(out.setupGbp).toBeCloseTo(1800, 2);
  });
  it("voice-only → no chat row", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "voice", voice_tier: "ignition",
        chat_tier: undefined, coupon_code: undefined },
      discountPercent: 0, bypass: false,
    });
    expect(out.chat).toBeNull();
    expect(out.voice?.monthly_price_gbp).toBe(1299);
  });
  it("bypass (100%-off) → zero prices, status active", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "chat", chat_tier: "ignition",
        voice_tier: undefined, coupon_code: "FREE" },
      discountPercent: 100, bypass: true,
    });
    expect(out.tenant.status).toBe("active");
    expect(out.tenant.billing_bypass).toBe(true);
    expect(out.chat?.monthly_price_gbp).toBe(0);
    expect(out.setupGbp).toBe(0);
  });
  it("chat full_throttle uses the list price (£1299)", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "chat", chat_tier: "full_throttle",
        voice_tier: undefined, coupon_code: undefined },
      discountPercent: 0, bypass: false,
    });
    expect(out.chat?.monthly_price_gbp).toBe(1299);
    expect(out.voice).toBeNull();
  });
  it("double_decker full_throttle: voice full + discounted chat", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "double_decker", chat_tier: "full_throttle",
        voice_tier: "full_throttle", coupon_code: undefined },
      discountPercent: 0, bypass: false,
    });
    expect(out.chat?.monthly_price_gbp).toBe(999); // 1299 − 300
    expect(out.voice?.monthly_price_gbp).toBe(2199);
    expect(out.chat!.monthly_price_gbp + out.voice!.monthly_price_gbp).toBe(3198);
  });
  it("chat-only → voice row is null", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "chat", chat_tier: "ignition",
        voice_tier: undefined, coupon_code: undefined },
      discountPercent: 0, bypass: false,
    });
    expect(out.voice).toBeNull();
    expect(out.chat?.monthly_price_gbp).toBe(599);
  });
});
