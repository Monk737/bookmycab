export type TakeoverStatus = "bot" | "requested" | "human";
export type TakeoverAction = "claim" | "release" | "request";

/**
 * Pure transition for the takeover state machine.
 * - claim: bot|requested → human
 * - release: human → bot
 * - request: bot → requested
 * Any other (status, action) pair is a no-op (returns the current status).
 */
export function nextTakeoverState(current: TakeoverStatus, action: TakeoverAction): TakeoverStatus {
  if (action === "claim" && (current === "bot" || current === "requested")) return "human";
  if (action === "release" && current === "human") return "bot";
  if (action === "request" && current === "bot") return "requested";
  return current;
}

/** Staff may send a reply only while they hold the conversation. */
export function canStaffReply(status: TakeoverStatus): boolean {
  return status === "human";
}
