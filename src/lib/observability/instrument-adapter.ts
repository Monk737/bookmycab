import "server-only";
import type { DispatchAdapter } from "@/lib/dispatch/types";
import { recordHistogram } from "./metrics";
import { reportError } from "./error-reporting";
import { errMessage } from "./telemetry";

const TIMED_OPS: (keyof DispatchAdapter)[] = [
  "lookupAddress", "getZones", "getCapabilities", "getQuote",
  "createBooking", "getBooking", "modifyBooking", "cancelBooking", "searchFlights",
];

/**
 * Wraps a DispatchAdapter so every call records `dispatch_latency_ms`
 * {adapter, op, status} and reports failures. The returned object satisfies the
 * same DispatchAdapter contract.
 */
export function instrumentAdapter(adapter: DispatchAdapter, adapterName: string): DispatchAdapter {
  const proxy = {} as Record<string, unknown>;
  for (const op of TIMED_OPS) {
    if (typeof adapter[op] !== "function") continue;
    const original = (adapter[op] as (...args: unknown[]) => Promise<unknown>).bind(adapter);
    proxy[op] = async (...args: unknown[]) => {
      const start = Date.now();
      try {
        const result = await original(...args);
        recordHistogram("dispatch_latency_ms", Date.now() - start, { adapter: adapterName, op, status: "ok" });
        return result;
      } catch (err) {
        recordHistogram("dispatch_latency_ms", Date.now() - start, { adapter: adapterName, op, status: "error" });
        reportError(err, { adapter: adapterName, op, detail: errMessage(err) });
        throw err;
      }
    };
  }
  return proxy as unknown as DispatchAdapter;
}
