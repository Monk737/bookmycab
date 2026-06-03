import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VOICE_WF = join(process.cwd(), "N8N-Workflow & Data Table", "WA Voice Booking Processor.json");

function loadVoiceWorkflow() {
  const j = JSON.parse(readFileSync(VOICE_WF, "utf8")) as { nodes: { name: string; parameters: Record<string, unknown> }[] };
  return Object.fromEntries(j.nodes.map((n) => [n.name, n]));
}

describe("voice sub-workflow: Whisper language auto-detect", () => {
  it("Whisper_Transcribe no longer forces a hardcoded language", () => {
    const node = loadVoiceWorkflow()["Whisper_Transcribe"];
    const options = (node.parameters.options ?? {}) as Record<string, unknown>;
    expect(options.language).toBeUndefined();
  });

  it("Normalize_Voice derives and emits a `language` field", () => {
    const code = (loadVoiceWorkflow()["Normalize_Voice"].parameters.jsCode ?? "") as string;
    expect(code).toMatch(/function detectLang/);
    expect(code).toMatch(/language:\s*detectLang/);
  });
});
