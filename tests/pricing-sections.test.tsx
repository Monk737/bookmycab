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

afterEach(cleanup);

const RATES = { GBP: 1, EUR: 1.18, USD: 1.27 };

describe("PricingSections (three offerings)", () => {
  it("renders the WhatsApp Booking Suite at £499 + £999 setup", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.getByText("WhatsApp Booking Suite")).toBeInTheDocument();
    expect(screen.getByText("£499")).toBeInTheDocument();
    expect(screen.getAllByText(/£999/).length).toBeGreaterThan(0);
  });
  it("renders AI Voice Ignition at 1,000 calls / £1,999", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.getByText("Ignition")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("£1,999")).toBeInTheDocument();
  });
  it("renders Full Throttle as a customised / discovery-call card", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.getByText("Full Throttle")).toBeInTheDocument();
    expect(screen.getByText(/Customised pack/i)).toBeInTheDocument();
  });
  it("does NOT mention Double Decker or Mix & Match", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.queryByText(/Double Decker/i)).toBeNull();
    expect(screen.queryByText(/Mix & Match/i)).toBeNull();
  });
});
