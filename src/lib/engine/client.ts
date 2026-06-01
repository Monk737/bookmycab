import "server-only";
import { env } from "@/env";
import type { EngineRun } from "./types";

type Fetcher = typeof fetch;

export class EngineClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  /** Builds the configured client; throws a neutral error if engine env is absent. */
  static fromEnv(fetcher: Fetcher = fetch): EngineClient {
    if (!env.N8N_BASE_URL || !env.N8N_API_KEY) {
      throw new Error("Automation engine is not configured.");
    }
    return new EngineClient(env.N8N_BASE_URL.replace(/\/$/, ""), env.N8N_API_KEY, fetcher);
  }

  private async call(path: string, init?: RequestInit): Promise<Response> {
    return this.fetcher(`${this.baseUrl}/api/v1${path}`, {
      ...init,
      // Caller headers first, then the auth + content-type headers (callee-wins)
      // so a caller can never accidentally override the API key.
      headers: { ...(init?.headers ?? {}), "X-N8N-API-KEY": this.apiKey, "content-type": "application/json" },
    });
  }

  async isActive(workflowId: string): Promise<boolean> {
    const res = await this.call(`/workflows/${workflowId}`);
    if (!res.ok) throw new Error(`engine getWorkflow ${res.status}`);
    const json = (await res.json()) as { active?: boolean };
    return Boolean(json.active);
  }

  async activate(workflowId: string): Promise<void> {
    const res = await this.call(`/workflows/${workflowId}/activate`, { method: "POST" });
    if (!res.ok) throw new Error(`engine activate ${res.status}`);
  }

  async deactivate(workflowId: string): Promise<void> {
    const res = await this.call(`/workflows/${workflowId}/deactivate`, { method: "POST" });
    if (!res.ok) throw new Error(`engine deactivate ${res.status}`);
  }

  async listRuns(workflowId: string, limit = 50): Promise<EngineRun[]> {
    const res = await this.call(`/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}`);
    if (!res.ok) throw new Error(`engine listExecutions ${res.status}`);
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return (json.data ?? []).map((e) => ({
      id: String(e.id),
      finished: Boolean(e.finished),
      status: (e.status as string) ?? null,
      startedAt: (e.startedAt as string) ?? null,
      stoppedAt: (e.stoppedAt as string) ?? null,
    }));
  }
}
