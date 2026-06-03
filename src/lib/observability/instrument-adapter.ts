import "server-only";
import type { DispatchAdapter } from "@/lib/dispatch/types";
import { recordHistogram } from "./metrics";
import { reportError } from "./error-reporting";

const TIMED_OPS = new Set<string>([
  "lookupAddress", "getZones", "getCapabilities", "getQuote",
  "createBooking", "getBooking", "modifyBooking", "cancelBooking", "searchFlights",
]);

/**
 * Wraps a DispatchAdapter so every timed op records `dispatch_latency_ms`
 * {adapter, op, status} and reports failures. Implemented as a Proxy so the
 * wrapper preserves the target's prototype chain — `instanceof AutoCabAdapter`
 * (and the other concrete adapters) still holds — while transparently timing
 * the dispatch methods. Non-timed members pass through untouched.
 */
export function instrumentAdapter(adapter: DispatchAdapter, adapterName: string): DispatchAdapter {
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      const op = String(prop);
      if (!TIMED_OPS.has(op)) return value.bind(target);
      return async (...args: unknown[]) => {
        const start = Date.now();
        try {
          const result = await value.apply(target, args);
          recordHistogram("dispatch_latency_ms", Date.now() - start, { adapter: adapterName, op, status: "ok" });
          return result;
        } catch (err) {
          recordHistogram("dispatch_latency_ms", Date.now() - start, { adapter: adapterName, op, status: "error" });
          // The error message is captured by reportError as ErrorRecord.message;
          // pass only safe operational context as attributes (no free-form detail).
          reportError(err, { adapter: adapterName, op });
          throw err;
        }
      };
    },
  });
}
