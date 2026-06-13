/**
 * Field definitions for the per-tenant, per-product integration credential
 * vault. Pure data (no I/O), so it is shared by the server actions and the
 * client console. The DB stores arbitrary field_key/value rows; this file is
 * the single source of truth for which fields each product expects, their
 * labels, and which ones are secrets (masked in the view).
 */

export type CredProduct = "whatsapp" | "voice";

export interface FieldDef {
  key: string;
  label: string;
  /** Masked in the view, revealable on demand. */
  secret?: boolean;
  placeholder?: string;
}

export const PRODUCT_LABEL: Record<CredProduct, string> = {
  whatsapp: "WhatsApp Chatbot",
  voice: "AI Voice Booking Agent",
};

export const PRODUCTS: CredProduct[] = ["whatsapp", "voice"];

export const FIELDS: Record<CredProduct, FieldDef[]> = {
  whatsapp: [
    { key: "phone_number_id", label: "Phone Number ID" },
    { key: "waba_id", label: "WhatsApp Business Account ID" },
    { key: "meta_url", label: "Meta URL" },
    { key: "meta_phone_number", label: "Meta Phone Number" },
    { key: "access_token", label: "Access Token", secret: true },
    { key: "webhook_production_link", label: "Webhook Production Link" },
    { key: "autocab_api_secret", label: "AutoCab API Secret", secret: true },
    { key: "autocab_api_url", label: "AutoCab API URL" },
    { key: "datatable_id", label: "DataTable ID" },
    { key: "n8n_workflow_id", label: "n8n Workflow ID" },
  ],
  voice: [
    { key: "webhook_url", label: "Webhook URL" },
    { key: "vapi_webhook_secret", label: "Vapi Webhook Secret", secret: true },
    { key: "vapi_assistant_id", label: "Vapi Assistant ID" },
    { key: "vapi_phone_id", label: "Vapi Phone ID" },
    { key: "tenant_id", label: "Tenant ID" },
    { key: "automation_id", label: "Automation ID" },
    { key: "autocab_api_url", label: "AutoCab API URL" },
    { key: "autocab_api_secret", label: "AutoCab API Secret", secret: true },
    { key: "datatable_id", label: "DataTable ID" },
    { key: "n8n_workflow_id", label: "n8n Workflow ID" },
  ],
};

/** Human label for a field key (falls back to the raw key). */
export function fieldLabel(product: CredProduct, key: string): string {
  return FIELDS[product].find((f) => f.key === key)?.label ?? key;
}

/** Whether a field should be masked in the view. */
export function isSecretField(product: CredProduct, key: string): boolean {
  return FIELDS[product].find((f) => f.key === key)?.secret ?? false;
}

export function isValidProduct(p: string): p is CredProduct {
  return p === "whatsapp" || p === "voice";
}
