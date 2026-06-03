export interface LoadOptions {
  total: number;
  concurrency: number;
  /** Performs one request and resolves its latency in ms; rejects on failure. */
  send: (index: number) => Promise<number>;
}

export interface LoadResult {
  count: number;
  errors: number;
  latencies: number[];
}

/** Drives `total` sends through a fixed-size worker pool, collecting latencies. */
export async function runLoad(opts: LoadOptions): Promise<LoadResult> {
  const latencies: number[] = [];
  let errors = 0;
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= opts.total) return;
      try {
        latencies.push(await opts.send(i));
      } catch {
        errors++;
      }
    }
  }

  const workers = Math.max(1, Math.min(opts.concurrency, opts.total));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { count: latencies.length, errors, latencies };
}
