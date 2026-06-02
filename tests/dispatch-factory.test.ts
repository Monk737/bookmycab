import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDispatchAdapter, loadDispatchConfig } from "@/lib/dispatch/factory";
import { AutoCabAdapter } from "@/lib/dispatch/autocab/adapter";
import { ICabbiAdapter } from "@/lib/dispatch/icabbi/adapter";
import { CordicAdapter } from "@/lib/dispatch/cordic/adapter";
import { DispatchConfigError } from "@/lib/dispatch/errors";

/** A deps double: a tenant row + a vault secret keyed by tenant. */
function deps(opts: {
  adapter: string;
  companyId?: string | null;
  baseUrl?: string | null;
  secret?: string | null;
}) {
  return {
    loadTenantDispatch: vi.fn(async () => ({
      dispatchAdapter: opts.adapter,
      dispatchCompanyId: opts.companyId ?? null,
      dispatchBaseUrl: opts.baseUrl ?? null,
    })),
    loadAutoCabKey: vi.fn(async () => opts.secret ?? null),
  };
}

describe("loadDispatchConfig", () => {
  it("returns AutoCab config when fully provisioned", async () => {
    const d = deps({
      adapter: "autocab",
      companyId: "55",
      baseUrl: "https://acme.autocab.test/",
      secret: "sub-key",
    });
    const cfg = await loadDispatchConfig("t1", d);
    expect(cfg).toEqual({
      adapter: "autocab",
      companyId: 55,
      autoCab: { baseUrl: "https://acme.autocab.test", subscriptionKey: "sub-key" },
    });
  });

  it("throws DispatchConfigError when the tenant is missing", async () => {
    const d = {
      loadTenantDispatch: vi.fn(async () => null),
      loadAutoCabKey: vi.fn(async () => null),
    };
    await expect(loadDispatchConfig("missing", d)).rejects.toBeInstanceOf(DispatchConfigError);
  });

  it("throws DispatchConfigError when AutoCab base URL or key is missing", async () => {
    const noUrl = deps({ adapter: "autocab", companyId: "55", baseUrl: null, secret: "k" });
    await expect(loadDispatchConfig("t1", noUrl)).rejects.toBeInstanceOf(DispatchConfigError);
    const noKey = deps({ adapter: "autocab", companyId: "55", baseUrl: "https://x.test", secret: null });
    await expect(loadDispatchConfig("t1", noKey)).rejects.toBeInstanceOf(DispatchConfigError);
  });

  it("does not require an AutoCab key for stub adapters", async () => {
    const d = deps({ adapter: "icabbi", companyId: "9" });
    const cfg = await loadDispatchConfig("t1", d);
    expect(cfg).toEqual({ adapter: "icabbi", companyId: 9, autoCab: null });
    expect(d.loadAutoCabKey).not.toHaveBeenCalled();
  });
});

describe("getDispatchAdapter", () => {
  it("returns an AutoCabAdapter for autocab tenants", async () => {
    const d = deps({
      adapter: "autocab",
      companyId: "55",
      baseUrl: "https://acme.autocab.test",
      secret: "sub-key",
    });
    expect(await getDispatchAdapter("t1", d)).toBeInstanceOf(AutoCabAdapter);
  });
  it("returns the iCabbi stub for icabbi tenants", async () => {
    expect(await getDispatchAdapter("t1", deps({ adapter: "icabbi", companyId: "1" }))).toBeInstanceOf(
      ICabbiAdapter,
    );
  });
  it("returns the Cordic stub for cordic tenants", async () => {
    expect(await getDispatchAdapter("t1", deps({ adapter: "cordic", companyId: "1" }))).toBeInstanceOf(
      CordicAdapter,
    );
  });
  it("throws DispatchConfigError for an unknown adapter value", async () => {
    await expect(
      getDispatchAdapter("t1", deps({ adapter: "weird", companyId: "1" })),
    ).rejects.toBeInstanceOf(DispatchConfigError);
  });
});
