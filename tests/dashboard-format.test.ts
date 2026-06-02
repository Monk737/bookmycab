import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDateTime,
  addressOneLine,
  truncateId,
  formatDurationMs,
} from "@/lib/dashboard/format";

describe("formatCurrency", () => {
  it("formats GBP/EUR/USD with symbol and 2dp", () => {
    expect(formatCurrency(23.5, "GBP")).toBe("£23.50");
    expect(formatCurrency(1000, "EUR")).toBe("€1,000.00");
    expect(formatCurrency(9.9, "USD")).toBe("$9.90");
  });
  it("renders an em-dash for null/NaN", () => {
    expect(formatCurrency(null, "GBP")).toBe("—");
    expect(formatCurrency(Number.NaN, "GBP")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO instant in the given IANA tz", () => {
    const out = formatDateTime("2026-06-01T14:30:00.000Z", "Europe/London");
    expect(out).toMatch(/15:30/);
    expect(out).toMatch(/2026/);
  });
  it("returns em-dash for null/unparseable", () => {
    expect(formatDateTime(null, "Europe/London")).toBe("—");
    expect(formatDateTime("nope", "Europe/London")).toBe("—");
  });
});

describe("addressOneLine", () => {
  it("joins town + postcode from an address json object", () => {
    expect(addressOneLine({ town: "Slough", postcode: "SL1 1AA" })).toBe("Slough, SL1 1AA");
  });
  it("falls back to label or em-dash", () => {
    expect(addressOneLine({ label: "Heathrow T5" })).toBe("Heathrow T5");
    expect(addressOneLine(null)).toBe("—");
    expect(addressOneLine({})).toBe("—");
  });
});

describe("truncateId", () => {
  it("shows the first 8 chars of a uuid", () => {
    expect(truncateId("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567");
    expect(truncateId(null)).toBe("—");
  });
});

describe("formatDurationMs", () => {
  it("formats ms as human duration", () => {
    expect(formatDurationMs(950)).toBe("0.9s");
    expect(formatDurationMs(1500)).toBe("1.5s");
    expect(formatDurationMs(65000)).toBe("1m 5s");
    expect(formatDurationMs(null)).toBe("—");
  });
});
