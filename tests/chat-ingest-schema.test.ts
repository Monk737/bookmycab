import { describe, it, expect } from "vitest";
import { parseChatBookingBody, parseChatConversationBody } from "@/lib/chat/ingest-schema";

const ids = {
  tenant_id: "bf8324b0-e9c9-40c9-808f-d6ffadbb3c2c",
  automation_id: "ac16646f-d249-4c71-858d-34775d272390",
};

describe("chat ingest summary limit", () => {
  // The workflow appends the readable transcript to `summary`; long chats reached ~10k chars
  // and every POST came back "Invalid body." while the cap was 8000.
  it("accepts a 20,000-char conversation summary and rejects one char more", () => {
    const body = { ...ids, conversation_ref: "447700900123-abc#quoted", customer_handle: "447700900123" };
    expect(parseChatConversationBody({ ...body, summary: "x".repeat(20000) }).success).toBe(true);
    expect(parseChatConversationBody({ ...body, summary: "x".repeat(20001) }).success).toBe(false);
  });

  it("accepts a 20,000-char booking summary and rejects one char more", () => {
    const body = { ...ids, dispatch_ref: "420435", status: "booked" };
    expect(parseChatBookingBody({ ...body, summary: "x".repeat(20000) }).success).toBe(true);
    expect(parseChatBookingBody({ ...body, summary: "x".repeat(20001) }).success).toBe(false);
  });
});
