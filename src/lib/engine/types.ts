/** Customer-neutral status — NO n8n vocabulary crosses this boundary. */
export type EngineStatus = "active" | "inactive";

export type EngineRun = {
  id: string;
  finished: boolean;
  status: string | null; // success | error | running | waiting (passed through, neutral)
  startedAt: string | null;
  stoppedAt: string | null;
};

/**
 * Remaps a raw engine run status to customer-neutral vocabulary so no internal
 * status string ever leaks onto a tenant-facing surface (brand rule). Unknown or
 * null inputs collapse to "unknown".
 */
export function neutralRunStatus(raw: string | null): string {
  switch (raw) {
    case "success":
      return "completed";
    case "error":
    case "crashed":
      return "failed";
    case "running":
      return "running";
    case "waiting":
      return "pending";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
}
