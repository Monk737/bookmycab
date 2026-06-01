/** Customer-neutral status — NO n8n vocabulary crosses this boundary. */
export type EngineStatus = "active" | "inactive";

export type EngineRun = {
  id: string;
  finished: boolean;
  status: string | null; // success | error | running | waiting (passed through, neutral)
  startedAt: string | null;
  stoppedAt: string | null;
};
