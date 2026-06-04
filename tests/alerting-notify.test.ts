// tests/alerting-notify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/entitlements/meter", () => ({ recordUsage: vi.fn() }));
const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ insert }) }),
}));

import { sendEmail } from "@/lib/email/resend";
import { recordUsage } from "@/lib/entitlements/meter";
import { dispatchNotification } from "@/lib/alerting/notify";

describe("dispatchNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email, logs sent, and meters one notification", async () => {
    vi.mocked(sendEmail).mockResolvedValue(true);
    const res = await dispatchNotification(
      { tenantId: "t1", channel: { id: "c1", type: "email", destination: "ops@cab.co" }, alertEventId: "e1", text: "Alert!" },
    );
    expect(res.status).toBe("sent");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalled(); // notification_log row
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", featureKey: "alerting" }));
  });

  it("logs failed when the send fails and does NOT meter", async () => {
    vi.mocked(sendEmail).mockResolvedValue(false);
    const res = await dispatchNotification(
      { tenantId: "t1", channel: { id: "c1", type: "email", destination: "ops@cab.co" }, alertEventId: "e1", text: "Alert!" },
    );
    expect(res.status).toBe("failed");
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
