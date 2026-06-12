import { z } from "zod";

export const OUTCOMES = [
  "booked",
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
});

export function parseIngestBody(input: unknown) {
  return ingestSchema.safeParse(input);
}
