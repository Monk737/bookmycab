import { describe, it, expect } from "vitest";
import { whatsAppLink } from "@/lib/marketing/whatsapp";

describe("whatsAppLink", () => {
  it("builds a wa.me link from an international number, stripping non-digits", () => {
    expect(whatsAppLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
  });
  it("appends a URL-encoded prefilled message", () => {
    expect(whatsAppLink("447700900123", "Hi there!")).toBe("https://wa.me/447700900123?text=Hi%20there!");
  });
  it("returns null when the number is missing or has no digits", () => {
    expect(whatsAppLink(undefined)).toBeNull();
    expect(whatsAppLink("")).toBeNull();
    expect(whatsAppLink("n/a")).toBeNull();
  });
});
