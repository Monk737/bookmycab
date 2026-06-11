import { describe, it, expect } from "vitest";
import {
  VOICE_PLAN_SPEC,
  setupFeeGbp,
  resolveNewModelPricing,
} from "@/lib/billing/pricing";

describe("VOICE_PLAN_SPEC", () => {
  it("maps tier → allowance + included agents", () => {
    expect(VOICE_PLAN_SPEC.ignition).toEqual({ callAllowance: 1500, includedAgents: 1 });
    expect(VOICE_PLAN_SPEC.in_motion).toEqual({ callAllowance: 2250, includedAgents: 2 });
    expect(VOICE_PLAN_SPEC.full_throttle).toEqual({ callAllowance: 3000, includedAgents: 2 });
  });
});

describe("setupFeeGbp", () => {
  it("chat = 1000", () => {
    expect(setupFeeGbp("chat", 0)).toBe(1000);
  });
  it("voice = 1000 (1 agent) / 1500 (2 agents)", () => {
    expect(setupFeeGbp("voice", 1)).toBe(1000);
    expect(setupFeeGbp("voice", 2)).toBe(1500);
  });
  it("double_decker = 1500 (1 voice agent) / 2000 (2 voice agents)", () => {
    expect(setupFeeGbp("double_decker", 1)).toBe(1500);
    expect(setupFeeGbp("double_decker", 2)).toBe(2000);
  });
});

describe("resolveNewModelPricing", () => {
  it("chat-only: chat price set, voice null, setup 1000", () => {
    const r = resolveNewModelPricing({
      model: "chat", chatTier: "in_motion", chatMode: "bundle", voiceTier: null,
    });
    expect(r).toEqual({ chatGbp: 1799, voiceGbp: null, voiceAllowance: null, voiceAgents: null, setupGbp: 1000 });
  });
  it("voice-only: voice price + allowance/agents, chat null, setup by agents", () => {
    const r = resolveNewModelPricing({
      model: "voice", chatTier: null, chatMode: null, voiceTier: "in_motion",
    });
    expect(r).toEqual({ chatGbp: null, voiceGbp: 1599, voiceAllowance: 2250, voiceAgents: 2, setupGbp: 1500 });
  });
  it("double_decker: authored split + allowance + bundle setup", () => {
    const r = resolveNewModelPricing({
      model: "double_decker", chatTier: "in_motion", chatMode: "bundle", voiceTier: "in_motion",
    });
    expect(r).toEqual({ chatGbp: 1600, voiceGbp: 1599, voiceAllowance: 2250, voiceAgents: 2, setupGbp: 2000 });
  });
  it("full_throttle chat is quoted: chatGbp null (caller must supply override)", () => {
    const r = resolveNewModelPricing({
      model: "chat", chatTier: "full_throttle", chatMode: "single", voiceTier: null,
    });
    expect(r.chatGbp).toBeNull();
  });
});
