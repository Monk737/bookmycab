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

/** Booking-status label for the Chat bookings feed. `confirmed` reads as "Booked". */
const BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "Booked",
  modified: "Modified",
  cancelled: "Cancelled",
  dispatched: "Dispatched",
  completed: "Completed",
  no_show: "No show",
};

export function bookingStatusLabel(s: string): string {
  return BOOKING_STATUS_LABEL[s] ?? s.replace("_", " ");
}

/** "5.2 miles" / "12 km". Returns null when no distance is recorded. */
export function formatDistance(distance: number | null, unit: string | null): string | null {
  if (distance == null || !Number.isFinite(distance)) return null;
  const u = (unit ?? "miles").toLowerCase();
  return `${distance.toFixed(1)} ${u}`;
}

/**
 * Chat booking pickup time. `pickup_at_utc` is a real UTC instant (timestamptz), so it is
 * shown on the UK clock the customer chose — unlike voice's `fmtPickup`, which takes a
 * tz-less wall-clock string and would show the raw UTC digits (an hour early in BST).
 */
export function fmtChatPickup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
