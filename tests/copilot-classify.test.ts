// tests/copilot-classify.test.ts
import { describe, it, expect } from "vitest";
import { classifyQuestion, formatAnswer, estimateTokens, type CopilotIntent } from "@/lib/copilot/classify";

describe("classifyQuestion", () => {
  it("maps revenue questions", () => {
    expect(classifyQuestion("How much revenue did we make this month?")).toBe("revenue");
    expect(classifyQuestion("what were our earnings")).toBe("revenue");
  });
  it("maps bookings-count questions", () => {
    expect(classifyQuestion("How many bookings did we get?")).toBe("bookings_count");
    expect(classifyQuestion("number of rides last week")).toBe("bookings_count");
  });
  it("maps top-destinations questions", () => {
    expect(classifyQuestion("What are the most popular destinations?")).toBe("top_destinations");
  });
  it("maps abandonment questions", () => {
    expect(classifyQuestion("why are customers dropping off / abandoning?")).toBe("abandonment");
  });
  it("falls back to help for anything else", () => {
    expect(classifyQuestion("tell me a joke")).toBe("help");
  });
});

describe("formatAnswer", () => {
  it("renders revenue with currency", () => {
    const a = formatAnswer("revenue", { total: 1234.5, completed: 40 });
    expect(a).toMatch(/£1,?234.50/);
    expect(a).toMatch(/40/);
  });
  it("renders bookings count", () => {
    expect(formatAnswer("bookings_count", { total: 87 })).toMatch(/87/);
  });
  it("lists top destinations", () => {
    const a = formatAnswer("top_destinations", { items: [{ name: "Heathrow", value: 12 }, { name: "City", value: 5 }] });
    expect(a).toMatch(/Heathrow/);
    expect(a).toMatch(/12/);
  });
  it("help lists example questions", () => {
    expect(formatAnswer("help", {})).toMatch(/revenue|bookings|destinations/i);
  });
});

describe("estimateTokens", () => {
  it("approximates ~1 token per 4 chars, min 1", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("12345678")).toBe(2);
  });
});
