import { describe, it, expect, beforeAll, vi } from "vitest";

// The redis modules are `server-only`; stub it so they load under the test
// runner (same pattern the rest of the suite uses for server-only modules).
vi.mock("server-only", () => ({}));

import { isRedisConfigured } from "@/lib/redis/client";
import { getOrSet, del } from "@/lib/redis/cache";
import { claimOnce } from "@/lib/redis/idempotency";
import { fixedWindow } from "@/lib/redis/rate-limit";

const run = isRedisConfigured() ? describe : describe.skip;

run("redis primitives (live SRH)", () => {
  const uniq = `epic5test:${Date.now()}`;

  it("getOrSet caches the loader result and serves it on the second call", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return { n: calls };
    };
    const a = await getOrSet(`${uniq}:cache`, 30, loader);
    const b = await getOrSet(`${uniq}:cache`, 30, loader);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 }); // served from cache, loader not re-run
    expect(calls).toBe(1);
    await del(`${uniq}:cache`);
  });

  it("getOrSet negative-caches a null loader result (loader runs exactly once)", async () => {
    let calls = 0;
    const nullLoader = async (): Promise<null> => {
      calls += 1;
      return null;
    };
    const a = await getOrSet(`${uniq}:null`, 30, nullLoader);
    const b = await getOrSet(`${uniq}:null`, 30, nullLoader);
    expect(a).toBeNull();  // first call returns null
    expect(b).toBeNull();  // second call returns cached null, not a re-run
    expect(calls).toBe(1); // loader ran exactly once — null was cached via sentinel
    await del(`${uniq}:null`);
  });

  it("claimOnce returns true once then false within the window", async () => {
    const first = await claimOnce(`${uniq}:idem`, 30);
    const second = await claimOnce(`${uniq}:idem`, 30);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("fixedWindow allows up to the limit then denies", async () => {
    const k = `${uniq}:rate`;
    const r1 = await fixedWindow(k, 2, 30);
    const r2 = await fixedWindow(k, 2, 30);
    const r3 = await fixedWindow(k, 2, 30);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    await del(k);
  });
});
