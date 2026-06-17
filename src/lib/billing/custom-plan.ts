/**
 * Pure custom-plan model (Full Throttle). No I/O — zod schema + resolver +
 * date math, imported by the provisioning form, the server action, and tests.
 */
import { z } from "zod";
import type { CommercialModel } from "@/lib/billing/pricing";

export const customPlanSchema = z
  .object({
    planName: z.string().trim().min(1, "Plan name is required."),
    billingMode: z.enum(["recurring", "one_time"]),
    includesChat: z.boolean(),
    includesVoice: z.boolean(),
    callAllowance: z.coerce.number().int().min(0),
    includedAgents: z.coerce.number().int().min(0),
    planPriceGbp: z.coerce.number().min(0),
    setupFeeGbp: z.coerce.number().min(0),
    validityDays: z.coerce.number().int().positive("Validity must be at least 1 day."),
    extraCreditPriceGbp: z.coerce.number().min(0),
    pricePerCallGbp: z.coerce.number().min(0).nullable().optional(),
    chatMonthlyGbp: z.coerce.number().min(0).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.includesChat && !d.includesVoice)
      ctx.addIssue({ code: "custom", path: ["includesVoice"], message: "A custom plan must include the WhatsApp Suite, AI Voice, or both." });
    if (d.includesChat && (d.chatMonthlyGbp == null || Number.isNaN(d.chatMonthlyGbp)))
      ctx.addIssue({ code: "custom", path: ["chatMonthlyGbp"], message: "Set the WhatsApp Suite monthly price." });
  });

export type CustomPlanInput = z.infer<typeof customPlanSchema>;

export interface ResolvedCustomPlan {
  commercialModel: CommercialModel; // always "custom"
  chatGbp: number | null;
  voiceGbp: number | null;
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
  /** Setup + first period total (what the activation invoice charges). */
  firstPeriodGbp: number;
  extraCreditPriceGbp: number;
}

export function resolveCustomPlan(input: CustomPlanInput): ResolvedCustomPlan {
  const chatGbp = input.includesChat ? Number(input.chatMonthlyGbp ?? 0) : null;
  const voiceGbp = input.includesVoice ? input.planPriceGbp : null;
  const voiceAllowance = input.includesVoice ? input.callAllowance : null;
  const voiceAgents = input.includesVoice ? input.includedAgents : null;
  const firstPeriodGbp = (chatGbp ?? 0) + (voiceGbp ?? 0);
  return {
    commercialModel: "custom",
    chatGbp,
    voiceGbp,
    voiceAllowance,
    voiceAgents,
    setupGbp: input.setupFeeGbp,
    firstPeriodGbp,
    extraCreditPriceGbp: input.extraCreditPriceGbp,
  };
}

/** start date (YYYY-MM-DD) + validity days → expiry date (YYYY-MM-DD, UTC). */
export function packExpiry(startIso: string, validityDays: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + validityDays);
  return d.toISOString().slice(0, 10);
}
