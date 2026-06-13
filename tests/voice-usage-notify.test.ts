import { describe, it, expect } from "vitest";
import { usageNoticesFor } from "@/lib/voice/usage-notify";
import { voiceUsageLowEmail, voicePlanExhaustedEmail } from "@/lib/email/templates";

const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
function assertClean(b: { subject: string; html: string; text: string }) {
  for (const s of [b.subject, b.html, b.text]) expect(s).not.toMatch(banned);
}

describe("usageNoticesFor", () => {
  it("no allowance → no notice (legacy/unmetered tenant)", () => {
    expect(usageNoticesFor({ creditSource: "plan", used: 0, allowance: 0 })).toEqual([]);
  });

  it("plenty of headroom → no notice", () => {
    expect(usageNoticesFor({ creditSource: "plan", used: 100, allowance: 1500 })).toEqual([]);
  });

  it("at/under 10% remaining on plan → plan_low", () => {
    // 1500 allowance, threshold = 150 remaining. used 1350 → 150 remaining.
    expect(usageNoticesFor({ creditSource: "plan", used: 1350, allowance: 1500 })).toEqual(["plan_low"]);
    expect(usageNoticesFor({ creditSource: "plan", used: 1400, allowance: 1500 })).toEqual(["plan_low"]);
  });

  it("just above the low threshold → no notice yet", () => {
    expect(usageNoticesFor({ creditSource: "plan", used: 1349, allowance: 1500 })).toEqual([]);
  });

  it("pool used up but still charging top-up credit → plan_exhausted", () => {
    expect(usageNoticesFor({ creditSource: "topup", used: 1500, allowance: 1500 })).toEqual(["plan_exhausted"]);
  });

  it("call declined (no plan, no credit) → credit_blocked, never doubled with plan_exhausted", () => {
    expect(usageNoticesFor({ creditSource: "none", used: 1500, allowance: 1500 })).toEqual(["credit_blocked"]);
  });

  it("exactly the last plan call (used == allowance on plan) → plan_exhausted", () => {
    expect(usageNoticesFor({ creditSource: "plan", used: 1500, allowance: 1500 })).toEqual(["plan_exhausted"]);
  });
});

describe("voiceUsageLowEmail", () => {
  const out = voiceUsageLowEmail({ tenantName: "Speedy Cabs", remaining: 150, allowance: 1500, dashboardUrl: "https://bookmycab.io/dashboard" });
  it("shows remaining and allowance, points to dashboard", () => {
    expect(out.subject).toMatch(/running low/i);
    expect(out.html).toMatch(/150/);
    expect(out.html).toMatch(/1500/);
    expect(out.html).toMatch(/https:\/\/bookmycab\.io\/dashboard/);
  });
  it("stays on-brand", () => assertClean(out));
});

describe("voicePlanExhaustedEmail", () => {
  it("blocked variant is urgent and shows zero credit", () => {
    const out = voicePlanExhaustedEmail({ tenantName: "Speedy Cabs", creditBalance: 0, blocked: true, dashboardUrl: "https://bookmycab.io/dashboard" });
    expect(out.subject).toMatch(/can't answer/i);
    expect(out.html).toMatch(/paused/i);
    assertClean(out);
  });
  it("on-credit variant is informational and shows remaining credit", () => {
    const out = voicePlanExhaustedEmail({ tenantName: "Speedy Cabs", creditBalance: 42, blocked: false, dashboardUrl: "https://bookmycab.io/dashboard" });
    expect(out.subject).toMatch(/used up/i);
    expect(out.html).toMatch(/42 calls/);
    assertClean(out);
  });
});
