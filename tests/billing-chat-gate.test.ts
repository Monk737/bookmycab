import { describe, it, expect } from "vitest";
import { chatServiceAllowed } from "@/lib/billing/chat-gate";

describe("chatServiceAllowed", () => {
  it("allows an active chat subscription", () => {
    expect(chatServiceAllowed("active")).toBe(true);
  });
  it("allows when there is no chat subscription row (legacy/grandfathered tenant)", () => {
    expect(chatServiceAllowed(null)).toBe(true);
    expect(chatServiceAllowed(undefined)).toBe(true);
  });
  it("blocks a paused or cancelled chat subscription", () => {
    expect(chatServiceAllowed("paused")).toBe(false);
    expect(chatServiceAllowed("cancelled")).toBe(false);
  });
});
