import { describe, it, expect } from "vitest";
import { iataPrefix, airlineForFlightNumber } from "@/lib/dispatch/iata";

describe("iataPrefix", () => {
  it("extracts a 2-letter prefix", () => {
    expect(iataPrefix("BA245")).toBe("BA");
    expect(iataPrefix("ba 245")).toBe("BA");
  });
  it("extracts an alphanumeric prefix (e.g. easyJet U2, Jet2 LS)", () => {
    expect(iataPrefix("U28042")).toBe("U2");
    expect(iataPrefix("LS810")).toBe("LS");
  });
  it("returns null when there is no usable prefix", () => {
    expect(iataPrefix("")).toBeNull();
    expect(iataPrefix("1234")).toBeNull();
  });
});

describe("airlineForFlightNumber", () => {
  it("resolves known carriers", () => {
    expect(airlineForFlightNumber("BA245")).toBe("British Airways");
    expect(airlineForFlightNumber("U28042")).toBe("easyJet");
    expect(airlineForFlightNumber("FR1234")).toBe("Ryanair");
    expect(airlineForFlightNumber("VS155")).toBe("Virgin Atlantic");
  });
  it("is case-insensitive", () => {
    expect(airlineForFlightNumber("ba245")).toBe("British Airways");
  });
  it("returns null for unknown carriers", () => {
    expect(airlineForFlightNumber("ZZ999")).toBeNull();
    expect(airlineForFlightNumber("")).toBeNull();
  });
});
