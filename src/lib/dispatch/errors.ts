/** Base error for the dispatch layer. Messages stay customer-neutral. */
export class DispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchError";
  }
}

/** Tenant dispatch config is missing or invalid (no key, no company id, etc.). */
export class DispatchConfigError extends DispatchError {
  constructor(message: string) {
    super(message);
    this.name = "DispatchConfigError";
  }
}

/** A stub adapter (iCabbi/Cordic) method was called before v1.2 shipped. */
export class DispatchNotImplementedError extends DispatchError {
  readonly method: string;
  constructor(vendor: string, method: string) {
    super(`${vendor} dispatch is not yet available.`);
    this.name = "DispatchNotImplementedError";
    this.method = method;
  }
}
