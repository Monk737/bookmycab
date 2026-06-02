import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AutomationConfigSchema } from "@/lib/dashboard/config-types";
import { getAutomationConfig } from "@/lib/dashboard/config-queries";
import { getChannels } from "@/lib/dashboard/channels-queries";
import { listTickets } from "@/lib/dashboard/support-queries";

function fake(data: unknown) {
  const calls: { m: string; a: unknown[] }[] = [];
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "gte", "lte"]) b[m] = (...a: unknown[]) => { calls.push({ m, a }); return b; };
  b.maybeSingle = (...a: unknown[]) => { calls.push({ m: "maybeSingle", a }); return Promise.resolve({ data, error: null }); };
  (b as { then: unknown }).then = (res: (v: unknown) => void) => res({ data, error: null });
  return { client: { from: (t: string) => { calls.push({ m: "from", a: [t] }); return b; } }, calls };
}

describe("AutomationConfigSchema", () => {
  it("accepts a valid partial config", () => {
    expect(AutomationConfigSchema.safeParse({ service_area: "Slough", ask_driver_note: true }).success).toBe(true);
  });
  it("rejects a non-array vehicle_types", () => {
    expect(AutomationConfigSchema.safeParse({ vehicle_types: "Saloon" }).success).toBe(false);
  });
});

describe("query table targets", () => {
  it("getChannels -> channels", async () => {
    const f = fake([]); await getChannels("a1", f.client as never);
    expect(f.calls.find((c) => c.m === "from")?.a[0]).toBe("channels");
    expect(f.calls.some((c) => c.m === "eq" && c.a[0] === "automation_id")).toBe(true);
  });
  it("listTickets -> support_tickets", async () => {
    const f = fake([]); await listTickets("t1", f.client as never);
    expect(f.calls.find((c) => c.m === "from")?.a[0]).toBe("support_tickets");
  });
  it("getAutomationConfig -> automation_config", async () => {
    const f = fake(null); await getAutomationConfig("a1", f.client as never);
    expect(f.calls.find((c) => c.m === "from")?.a[0]).toBe("automation_config");
  });
});
