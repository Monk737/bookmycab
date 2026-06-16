/** Client-safe Chat label helpers (NO server-only — importable from client components). */

export type ChatOutcome = "booked" | "quoted" | "managed" | "abandoned" | "cancelled" | "failed" | "unknown";

export const CHAT_OUTCOMES: ChatOutcome[] = [
  "booked", "quoted", "managed", "abandoned", "cancelled", "failed", "unknown",
];

export const OUTCOME_LABEL: Record<ChatOutcome, string> = {
  booked: "Booked",
  quoted: "Quoted",
  managed: "Managed",
  abandoned: "Abandoned",
  cancelled: "Cancelled",
  failed: "Failed",
  unknown: "Unknown",
};

export function chatOutcomeLabel(o: string): string {
  return OUTCOME_LABEL[o as ChatOutcome] ?? o;
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  widget: "Web widget",
};

export function channelLabel(t: string): string {
  return CHANNEL_LABEL[t] ?? t;
}
