import { describe, it, expect, vi } from "vitest";

// `server-only` throws outside Next.js' react-server condition (e.g. Vitest),
// so stub it — the same pattern every other server-only test in the suite uses.
vi.mock("server-only", () => ({}));

import { extractProviderMessageId } from "@/lib/webhooks/message-id";

describe("extractProviderMessageId", () => {
  it("whatsapp: messages[0].id", () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.ABC" }] } }] }] };
    expect(extractProviderMessageId("whatsapp", body)).toBe("wamid.ABC");
  });
  it("messenger/instagram: entry[0].messaging[0].message.mid", () => {
    const body = { entry: [{ messaging: [{ message: { mid: "m_123" } }] }] };
    expect(extractProviderMessageId("messenger", body)).toBe("m_123");
    expect(extractProviderMessageId("instagram", body)).toBe("m_123");
  });
  it("telegram: update_id", () => {
    expect(extractProviderMessageId("telegram", { update_id: 4242 })).toBe("4242");
  });
  it("widget: messageId", () => {
    expect(extractProviderMessageId("widget", { messageId: "w-9" })).toBe("w-9");
  });
  it("returns null when the id is absent (caller falls back to no-dedupe)", () => {
    expect(extractProviderMessageId("whatsapp", {})).toBeNull();
    expect(extractProviderMessageId("telegram", {})).toBeNull();
  });
});
