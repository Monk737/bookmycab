import { getSink, type Attrs } from "./sink";

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Times `fn`, records an ok/error span via the active sink, and re-throws on error. */
export async function withSpan<T>(name: string, attributes: Attrs, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    getSink().span({ name, attributes, durationMs: Date.now() - start, status: "ok" });
    return result;
  } catch (err) {
    getSink().span({ name, attributes, durationMs: Date.now() - start, status: "error", error: errMessage(err) });
    throw err;
  }
}
