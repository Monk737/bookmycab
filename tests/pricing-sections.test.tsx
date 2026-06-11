// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";

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
    expect(screen.getByText(/AI Voice Booking/i)).toBeInTheDocument();
    expect(screen.getByText(/Double Decker/i)).toBeInTheDocument();
  });

  it("renders chat Ignition single-channel price in GBP", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/£499/).length).toBeGreaterThan(0);
  });

  it("renders a voice tier price in GBP", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getAllByText(/£1,199/).length).toBeGreaterThan(0);
  });

  it("renders the extra voice credit price", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByText(/£0\.90/)).toBeInTheDocument();
  });

  it("renders the currency toggle", () => {
    render(<PricingSections rates={FX_FALLBACK} />);
    expect(screen.getByRole("radiogroup", { name: /currency/i })).toBeInTheDocument();
  });
});
