// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(() => { cleanup(); vi.resetModules(); });

async function renderWith(number: string | undefined) {
  vi.doMock("@/env.client", () => ({ clientEnv: { NEXT_PUBLIC_DEMO_WA_NUMBER: number } }));
  const { DemoWhatsAppCta } = await import("@/components/marketing/demo-whatsapp-cta");
  render(<DemoWhatsAppCta />);
}

describe("DemoWhatsAppCta", () => {
  it("renders a wa.me link when a demo number is configured", async () => {
    await renderWith("+44 7700 900123");
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link.getAttribute("href")).toBe("https://wa.me/447700900123?text=Hi%20CabbyBot%20%E2%80%94%20I'd%20like%20to%20try%20the%20demo%20booking%20bot.");
  });
  it("renders nothing when no demo number is configured", async () => {
    await renderWith(undefined);
    expect(screen.queryByRole("link", { name: /whatsapp/i })).toBeNull();
  });
});
