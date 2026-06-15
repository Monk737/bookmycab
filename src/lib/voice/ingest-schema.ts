import { z } from "zod";

export const OUTCOMES = [
  "booked",
  "modified",
  "cancelled",
  "quoted",
  "abandoned",
  "transferred",
  "failed",
  "unknown",
] as const;

export const ingestSchema = z.object({
  provider_call_id: z.string().min(1),
  tenant_id: z.string().uuid(),
  automation_id: z.string().uuid(),
  caller_number: z.string().optional(),
  agent_number: z.string().optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  duration_s: z.number().int().nonnegative().optional(),
  outcome: z.enum(OUTCOMES),
  /** Vapi analysisPlan output, stored verbatim on the call row. */
  summary: z.string().max(4000).optional(),
  success: z.boolean().optional(),
  // Tier 1 intelligence: route / fare / vehicle / airport, extracted by the
  // engine from the call's tool calls (with structured-data fallbacks).
  pickup: z.string().max(300).optional(),
  destination: z.string().max(300).optional(),
  quoted_fare: z.number().nonnegative().optional(),
  vehicle_type: z.string().max(40).optional(),
  booking_ref: z.string().max(60).optional(),
  airport_code: z.string().max(8).optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
  caller_name: z.string().max(120).optional(),
  abandon_reason: z.string().max(200).optional(),
  // Tier 2 quality: transcript, recording, and address-lookup count. Each field
  // is fault-tolerant: a malformed or oversized value degrades to "not captured"
  // (.catch(undefined)) rather than failing the whole body and dropping the call
  // from analytics + billing. recording_url intentionally drops strict url()
  // validation for the same reason — an odd provider URL must never cost us the
  // call record; the worst case is an <audio> element that won't play.
  transcript: z.string().max(100_000).optional().catch(undefined),
  recording_url: z.string().max(2048).optional().catch(undefined),
  address_lookups: z.number().int().nonnegative().optional().catch(undefined),
});

export function parseIngestBody(input: unknown) {
  return ingestSchema.safeParse(input);
}
