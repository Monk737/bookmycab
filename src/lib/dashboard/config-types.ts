import { z } from "zod";
export const AutomationConfigSchema = z.object({
  welcome_messages: z.record(z.string()).optional(),
  vehicle_types: z.array(z.string()).optional(),
  service_area: z.string().max(2000).nullable().optional(),
  opening_hours: z.record(z.array(z.tuple([z.string(), z.string()]))).optional(),
  brand_colours: z.object({ primary: z.string().optional(), secondary: z.string().optional() }).partial().optional(),
  languages: z.array(z.string()).optional(),
  ask_driver_note: z.boolean().optional(),
});
export type AutomationConfigInput = z.infer<typeof AutomationConfigSchema>;
export interface AutomationConfig extends AutomationConfigInput { automationId: string; updatedAt: string | null; }
