import { z } from "zod";

export const BOOKING_STATUSES = [
  "confirmed",
  "cancelled",
  "modified",
  "completed",
  "no_show",
] as const;

/**
 * Body for POST /api/voice/bookings — the AI Voice engine mirrors each Autocab
 * booking lifecycle event (create / modify / cancel) so the tenant dashboard can
 * show live booking status. Keyed on (tenant_id, booking_ref) by the upsert RPC;
 * a cancel only needs ref + status, and detail fields are preserved.
 */
export const voiceBookingSchema = z.object({
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid(),
  booking_ref: z.string().min(1),
  status: z.enum(BOOKING_STATUSES).default("confirmed"),
  provider_call_id: z.string().optional(),
  pickup: z.string().optional(),
  destination: z.string().optional(),
  pickup_time: z.string().optional(),
  passenger_name: z.string().optional(),
  passengers: z.number().int().nonnegative().optional(),
  bags: z.number().int().nonnegative().optional(),
  vehicle_type: z.string().optional(),
  fare: z.string().optional(),
  caller_number: z.string().optional(),
  /** Full dispatch response, stored verbatim for audit. */
  raw: z.unknown().optional(),
});

export function parseVoiceBookingBody(input: unknown) {
  return voiceBookingSchema.safeParse(input);
}
