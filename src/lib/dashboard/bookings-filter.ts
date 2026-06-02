import type { BookingRow } from "./types";
import { addressOneLine } from "./format";

const BOOKING_STATUSES = ["confirmed", "dispatched", "completed", "cancelled", "no_show"] as const;
const CHANNELS = ["whatsapp", "telegram", "messenger", "instagram", "widget"] as const;
const MODES = ["asap", "scheduled", "airport"] as const;
const OUTCOMES = ["booked", "quoted", "abandoned", "managed", "cancelled", "unknown"] as const;

export interface BookingFilter {
  page: number;
  limit: number;
  status?: (typeof BOOKING_STATUSES)[number];
  channel?: (typeof CHANNELS)[number];
  mode?: (typeof MODES)[number];
  search?: string;
  from?: string;
  to?: string;
}

export interface ConversationFilter {
  page: number;
  limit: number;
  outcome?: (typeof OUTCOMES)[number];
  channel?: string;
  language?: string;
  search?: string;
  from?: string;
  to?: string;
}

function intParam(v: string | null, dflt: number, min: number, max: number): number {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return dflt;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function pick<T extends readonly string[]>(v: string | null, allowed: T): T[number] | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

export function parseBookingFilter(params: URLSearchParams): BookingFilter {
  return {
    page: intParam(params.get("page"), 1, 1, 100000),
    limit: intParam(params.get("limit"), 50, 1, 100),
    status: pick(params.get("status"), BOOKING_STATUSES),
    channel: pick(params.get("channel"), CHANNELS),
    mode: pick(params.get("mode"), MODES),
    search: params.get("search")?.trim() || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}

export function parseConversationFilter(params: URLSearchParams): ConversationFilter {
  return {
    page: intParam(params.get("page"), 1, 1, 100000),
    limit: intParam(params.get("limit"), 50, 1, 100),
    outcome: pick(params.get("outcome"), OUTCOMES),
    channel: params.get("channel") || undefined,
    language: params.get("language") || undefined,
    search: params.get("search")?.trim() || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}

export const BOOKING_CSV_HEADERS = [
  "Booking ID", "Dispatch Ref", "Pickup (UTC)", "Customer", "Contact",
  "Channel", "Pickup", "Destination", "Vehicle", "Pax", "Fare", "Currency", "Status", "Mode",
] as const;

export function bookingToCsvRow(b: BookingRow): string[] {
  return [
    b.id, b.dispatchRef ?? "", b.pickupAtUtc ?? "", b.passengerName ?? "", b.customerHandle ?? "",
    b.channelType ?? "", addressOneLine(b.pickupAddress), addressOneLine(b.destinationAddress),
    b.vehicleType ?? "", String(b.passengerCount ?? ""), b.fare == null ? "" : String(b.fare),
    b.currency, b.status, b.pickupTimeMode ?? "",
  ];
}
