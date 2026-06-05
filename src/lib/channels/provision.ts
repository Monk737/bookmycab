export type ProvisioningStatus = "pending_review" | "approved" | "rejected";
export type ProvisioningAction = "approve" | "reject";

const CHANNEL_TYPES = ["whatsapp", "telegram", "messenger", "instagram", "widget"];

export interface ChannelRequest {
  type: string;
  externalId: string;
  automationId: string;
}

/** Pure: validate a self-serve channel request. Returns field names that failed. */
export function validateChannelRequest(input: ChannelRequest): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!CHANNEL_TYPES.includes(input.type)) errors.push("type");
  if (!input.externalId || !input.externalId.trim()) errors.push("externalId");
  if (!input.automationId || !input.automationId.trim()) errors.push("automationId");
  return { ok: errors.length === 0, errors };
}

/** Pure: provisioning state machine. Only a pending_review channel can transition. */
export function nextProvisioningState(current: ProvisioningStatus, action: ProvisioningAction): ProvisioningStatus {
  if (current !== "pending_review") return current;
  return action === "approve" ? "approved" : "rejected";
}
