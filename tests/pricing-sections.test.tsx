// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// DiscoveryCta pulls in the Cal.com embed (network at mount) and the validated
// client env; stub both so the render stays hermetic.
vi.mock("@calcom/embed-react", () => ({
  getCalApi: vi.fn().mockResolvedValue(vi.fn()),
}));
vi.mock("@/env.client", () => ({
  clientEnv: { NEXT_PUBLIC_CAL_LINK: "flowmo/discovery" },
}));

import { PricingSections } from "@/components/marketing/pricing-sections";
import { FX_FALLBACK } from "@/lib/marketing/fx";

afterEach(cleanup);

describe("PricingSections (default GBP)", () => {
  it("renders the three product section headings", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/^Chat$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI Voice Booking/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Double Decker/i)).toBeInTheDocument();
  });

  it("renders chat Ignition price in GBP", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/£599/).length).toBeGreaterThan(0);
  });

  it("renders a voice tier price in GBP", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/£1,299/).length).toBeGreaterThan(0);
  });

  it("renders the extra voice credit price", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByText(/£0\.90/)).toBeInTheDocument();
  });

  it("renders the currency toggle", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByRole("radiogroup", { name: /currency/i })).toBeInTheDocument();
  });

  it("switching to EUR re-renders converted prices", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    fireEvent.click(screen.getByRole("radio", { name: "EUR" }));
    // £599 * 1.18 = 706.82 → €707 (0-decimal formatting)
    expect(screen.getAllByText(/€707/).length).toBeGreaterThan(0);
  });
});
