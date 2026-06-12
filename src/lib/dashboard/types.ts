/** Shared dashboard DTOs (Epic 7a). Vendor/engine-neutral, customer-facing. */

export type AutomationStatus = "building" | "uat" | "live" | "stopped" | "error";
export type AutomationType = "Booking" | "Support" | "Driver" | "Custom";
export type BookingStatus = "confirmed" | "dispatched" | "completed" | "cancelled" | "no_show";
export type ChannelType = "whatsapp" | "telegram" | "messenger" | "instagram" | "widget";
export type ChannelHealth = "healthy" | "warning" | "disconnected";
export type ConversationOutcome =
  | "booked" | "quoted" | "abandoned" | "managed" | "cancelled" | "unknown";

export interface OrgSummary {
  id: string;
  name: string;
  commercialModel: string | null;
  contractRenewal: string | null;
  currency: "GBP" | "EUR" | "USD";
}

export interface ChannelHealthIcon {
  type: ChannelType;
  health: ChannelHealth;
}

export interface AutomationCard {
  id: string;
  name: string;
  type: AutomationType;
  status: AutomationStatus;
  dispatchAdapter: string | null;
  channels: ChannelHealthIcon[];
  bookingsToday: number;
  conversationsToday: number;
  conversionPct: number;
}

export interface KpiStrip {
  bookingsToday: number;
  conversationsToday: number;
  liveAutomations: number;
}

export interface BookingRow {
  id: string;
  dispatchRef: string | null;
  pickupAtUtc: string | null;
  passengerName: string | null;
  customerHandle: string | null;
  channelType: string | null;
  pickupAddress: unknown;
  destinationAddress: unknown;
  vehicleType: string | null;
  passengerCount: number | null;
  fare: number | null;
  currency: string;
  status: BookingStatus;
  pickupTimeMode: string | null;
}

export interface BookingDetail extends BookingRow {
  driverNote: string | null;
  airportJson: unknown;
  conversationId: string | null;
  rawDispatchJson: unknown;
  createdAt: string;
}

export interface ConversationRow {
  id: string;
  customerName: string | null;
  customerHandle: string;
  channelId: string | null;
  startedAt: string;
  endedAt: string | null;
  outcome: ConversationOutcome | null;
  language: string | null;
  messageCount: number;
}

export interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "voice" | "location" | "image" | "interactive" | "card";
  payload: unknown;
  transcript: string | null;
  intentExtracted: unknown;
  ts: string;
}

export interface ConversationDetail extends ConversationRow {
  abandonmentReason: string | null;
  bookingId: string | null;
  messages: MessageRow[];
}
