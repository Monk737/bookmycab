import { describe, it, expect } from "vitest";
import { selectProductAutomations } from "@/lib/engine/billing-pause";

describe("selectProductAutomations (pure product filter)", () => {
  const rows = [
    { id: "v1", type: "Voice" },
    { id: "c1", type: "Booking" },
    { id: "c2", type: "Support" },
    { id: "c3", type: "Custom" },
  ];
  it("voice product → only Voice automations", () => {
    expect(selectProductAutomations(rows, "voice").map((a) => a.id)).toEqual(["v1"]);
  });
  it("chat product → every non-Voice automation", () => {
    expect(selectProductAutomations(rows, "chat").map((a) => a.id)).toEqual(["c1", "c2", "c3"]);
  });
});
