import { describe, it, expect, vi, afterEach } from "vitest";
import { parseFxResponse, getFxRates, FX_FALLBACK } from "@/lib/marketing/fx";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("parseFxResponse()", () => {
  it("extracts EUR/USD and pins GBP to 1", () => {
    const out = parseFxResponse({ base: "GBP", rates: { EUR: 1.18, USD: 1.27 } });
    expect(out).toEqual({ GBP: 1, EUR: 1.18, USD: 1.27 });
  });
  it("returns null when rates are missing", () => {
    expect(parseFxResponse({ base: "GBP" })).toBeNull();
  });
  it("returns null when a rate is non-numeric", () => {
    expect(parseFxResponse({ rates: { EUR: "x", USD: 1.27 } })).toBeNull();
  });
  it("returns null for non-object input", () => {
    expect(parseFxResponse("nope")).toBeNull();
  });
});

describe("getFxRates()", () => {
  it("returns parsed live rates on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ rates: { EUR: 1.19, USD: 1.28 } }),
      })),
    );
    await expect(getFxRates()).resolves.toEqual({ GBP: 1, EUR: 1.19, USD: 1.28 });
  });
  it("falls back when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(getFxRates()).resolves.toEqual(FX_FALLBACK);
  });
  it("falls back when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(getFxRates()).resolves.toEqual(FX_FALLBACK);
  });
  it("falls back when the body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ rates: {} }) })),
    );
    await expect(getFxRates()).resolves.toEqual(FX_FALLBACK);
  });
});
