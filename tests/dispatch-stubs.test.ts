import { describe, it, expect } from "vitest";
import { DispatchError, DispatchNotImplementedError, DispatchConfigError } from "@/lib/dispatch/errors";

describe("dispatch errors", () => {
  it("DispatchError is an Error with the given message", () => {
    const e = new DispatchError("boom");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("DispatchError");
    expect(e.message).toBe("boom");
  });

  it("DispatchNotImplementedError names the vendor + method, neutrally", () => {
    const e = new DispatchNotImplementedError("iCabbi", "createBooking");
    expect(e).toBeInstanceOf(DispatchError);
    expect(e.name).toBe("DispatchNotImplementedError");
    expect(e.message).toBe("iCabbi dispatch is not yet available.");
    expect(e.method).toBe("createBooking");
    expect(e.message).not.toMatch(/n8n|workflow|execution/i);
  });

  it("DispatchConfigError is a DispatchError", () => {
    expect(new DispatchConfigError("bad")).toBeInstanceOf(DispatchError);
  });
});
