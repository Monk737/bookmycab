import { z } from "zod";

/* ----------------------------------------------------------------------------
   WhatsApp Chatbot (Chat + Voice Note) ingest bodies.

   The tenant's n8n chat workflow mirrors each meaningful journey state into the
   dashboard so the Chat analytics numbers are the workflow's own numbers. Two
   shapes, one per endpoint, mirroring the AI Voice ingest contract — but with NO
   call/credit fields, because a WhatsApp voice note is a transcribed audio
   message inside the same booking flow, not a phone call.
   -------------------------------------------------------------------------- */

export const CHAT_OUTCOMES = [
  "booked",
  "quoted",
  "abandoned",
  "managed",
  "cancelled",
  "unknown",
] as const;

/**
 * POST /api/chat/conversations — one mirror per journey state change. Keyed on
 * (tenant_id, conversation_ref) by the upsert RPC, so the same conversation_ref
 * advances a single row (e.g. open → quoted → booked) instead of duplicating.
 * conversation_ref is the per-journey key the workflow derives (phone : UK-day).
 */
export const chatConversationSchema = z.object({
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid(),
  conversation_ref: z.string().min(1).max(200),
  customer_handle: z.string().min(1).max(64),
  outcome: z.enum(CHAT_OUTCOMES).default("unknown"),
  channel: z
    .enum(["whatsapp", "telegram", "messenger", "instagram", "widget"])
    .default("whatsapp"),
  customer_name: z.string().max(120).optional(),
  started_at: z.string().optional(),
  /** True when this journey involved a WhatsApp voice note (analytics only). */
  via_voice: z.boolean().optional(),
  language: z.string().max(12).optional(),
});

export type ChatConversationBody = z.infer<typeof chatConversationSchema>;

export function parseChatConversationBody(input: unknown) {
  return chatConversationSchema.safeParse(input);
}

const BOOKING_STATUSES = [
  "booked",
  "confirmed",
  "modified",
  "cancelled",
  "completed",
  "no_show",
  "dispatched",
] as const;

/** Address objects are stored verbatim as jsonb; accept either a structured
 *  object or a plain text line (the RPC stores whatever it's given). */
const addressField = z
  .union([z.record(z.string(), z.unknown()), z.string()])
  .optional();

/**
 * POST /api/chat/bookings — mirror a confirmed / modified / cancelled dispatch
 * booking. Keyed on (tenant_id, dispatch_ref) by the upsert RPC; a cancel needs
 * only ref + status and preserves the original trip details.
 */
export const chatBookingSchema = z.object({
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid(),
  dispatch_ref: z.string().min(1).max(80),
  status: z.enum(BOOKING_STATUSES).default("booked"),
  conversation_ref: z.string().max(200).optional(),
  channel_type: z.string().max(20).optional(),
  dispatch_adapter: z.string().max(20).optional(),
  passenger_name: z.string().max(160).optional(),
  customer_handle: z.string().max(64).optional(),
  pickup: addressField,
  destination: addressField,
  vehicle_type: z.string().max(40).optional(),
  passenger_count: z.number().int().nonnegative().optional(),
  fare: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  pickup_at: z.string().optional(),
  pickup_time_mode: z.string().max(20).optional(),
  driver_note: z.string().max(2000).optional(),
  /** Full dispatch response, stored verbatim for audit. */
  raw: z.unknown().optional(),
});

export type ChatBookingBody = z.infer<typeof chatBookingSchema>;

export function parseChatBookingBody(input: unknown) {
  return chatBookingSchema.safeParse(input);
}
