// src/lib/voice/vapi.ts
import "server-only";
import { env } from "@/env";

export interface VapiMessage {
  role: string;
  content: string;
  [k: string]: unknown;
}
export interface VapiAssistant {
  id: string;
  model?: { messages?: VapiMessage[]; [k: string]: unknown };
  [k: string]: unknown;
}

/** True when a Vapi key is configured; callers degrade gracefully when false. */
export function vapiConfigured(): boolean {
  return Boolean(env.VAPI_API_KEY);
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" };
}

async function vapiFetch(path: string, init?: RequestInit): Promise<unknown> {
  if (!env.VAPI_API_KEY) throw new Error("Vapi is not configured (VAPI_API_KEY missing).");
  const res = await fetch(`${env.VAPI_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

/** Fetch the full assistant object. */
export async function getAssistant(assistantId: string): Promise<VapiAssistant> {
  return (await vapiFetch(`/assistant/${assistantId}`)) as VapiAssistant;
}

/** The current system-prompt text, or "" if the assistant has no system message. */
export function extractSystemPrompt(a: VapiAssistant): string {
  return a.model?.messages?.find((m) => m.role === "system")?.content ?? "";
}

export async function getSystemPrompt(assistantId: string): Promise<string> {
  return extractSystemPrompt(await getAssistant(assistantId));
}

/**
 * Replace the assistant's system prompt. Vapi's `model` is a nested object, so we
 * GET it first, swap the system message in `model.messages` (preserving every
 * other field + message), and PATCH the whole `model` back.
 */
export async function setSystemPrompt(assistantId: string, prompt: string): Promise<void> {
  const a = await getAssistant(assistantId);
  const messages: VapiMessage[] = [...(a.model?.messages ?? [])];
  const i = messages.findIndex((m) => m.role === "system");
  if (i >= 0) messages[i] = { ...messages[i], content: prompt };
  else messages.unshift({ role: "system", content: prompt });
  await vapiFetch(`/assistant/${assistantId}`, {
    method: "PATCH",
    body: JSON.stringify({ model: { ...(a.model ?? {}), messages } }),
  });
}
