// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { computeRoi } from "@/lib/marketing/roi";
import { formatPrice } from "@/lib/marketing/pricing";

afterEach(cleanup);

describe("RoiCalculator", () => {
  it("renders with default inputs and a yearly figure", () => {
    render(<RoiCalculator />);

    const missed = screen.getByLabelText(/missed bookings per day/i) as HTMLInputElement;
    const fare = screen.getByLabelText(/average fare/i) as HTMLInputElement;

    // Defaults are present and numeric.
    expect(Number(missed.value)).toBeGreaterThan(0);
    expect(Number(fare.value)).toBeGreaterThan(0);

    // The default yearly figure (GBP default currency) is displayed.
    const expected = computeRoi({
      missedBookingsPerDay: Number(missed.value),
      avgFare: Number(fare.value),
    });
    const yearly = screen.getByTestId("roi-per-year");
    expect(yearly).toHaveTextContent(formatPrice("GBP", expected.perYear));
  });

  it("recomputes the yearly figure when missed bookings change", () => {
    render(<RoiCalculator />);

    const missed = screen.getByLabelText(/missed bookings per day/i) as HTMLInputElement;
    const fare = screen.getByLabelText(/average fare/i) as HTMLInputElement;

    fireEvent.change(missed, { target: { value: "10" } });

    const expected = computeRoi({
      missedBookingsPerDay: 10,
      avgFare: Number(fare.value),
    });
    const yearly = screen.getByTestId("roi-per-year");
    expect(yearly).toHaveTextContent(formatPrice("GBP", expected.perYear));
  });

  it("recomputes the yearly figure when average fare changes", () => {
    render(<RoiCalculator />);

    const missed = screen.getByLabelText(/missed bookings per day/i) as HTMLInputElement;
    const fare = screen.getByLabelText(/average fare/i) as HTMLInputElement;

    fireEvent.change(fare, { target: { value: "42" } });

    const expected = computeRoi({
      missedBookingsPerDay: Number(missed.value),
      avgFare: 42,
    });
    const yearly = screen.getByTestId("roi-per-year");
    expect(yearly).toHaveTextContent(formatPrice("GBP", expected.perYear));
  });

  it("floors to zero (not NaN) when the missed-bookings field is cleared", () => {
    render(<RoiCalculator />);

    const missed = screen.getByLabelText(/missed bookings per day/i);
    fireEvent.change(missed, { target: { value: "" } });

    expect(screen.getByTestId("roi-per-year")).toHaveTextContent(
      formatPrice("GBP", 0),
    );
  });
});
