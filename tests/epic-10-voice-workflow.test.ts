import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VOICE_WF = join(process.cwd(), "N8N-Workflow & Data Table", "Premier-Mini-Cabs-Voice-Workflow.json");

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

describe("voice pipeline: previously-built wiring is intact", () => {
  it("voice sub-workflow has the Whisper→extract→normalize node chain", () => {
    const nodes = loadVoiceWorkflow();
    for (const name of ["When Called", "Get_Media_URL", "Download_Media", "Whisper_Transcribe", "Extract_Slots", "Normalize_Voice"]) {
      expect(nodes[name], name).toBeDefined();
    }
  });

  it("main workflow routes audio into the voice sub-workflow and merges at the intent router", () => {
    const mainPath = join(process.cwd(), "N8N-Workflow & Data Table", "Premier-Mini-Cabs-Main-Workflow.json");
    expect(existsSync(mainPath)).toBe(true);
    const j = JSON.parse(readFileSync(mainPath, "utf8")) as { nodes: { name: string }[] };
    const names = new Set(j.nodes.map((n) => n.name));
    for (const name of ["Detect_Audio", "IF_Voice", "Execute_Voice", "Apply_Voice_Slots", "Inject_Transcript"]) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it("transcript view renders the voice branch (transcript + extracted slots)", () => {
    const tsx = readFileSync(
      join(process.cwd(), "src/app/dashboard/automations/[automationId]/conversations/conversations-client.tsx"),
      "utf8",
    );
    expect(tsx).toMatch(/messageType === "voice"/);
    expect(tsx).toMatch(/Extracted slots/);
  });
});
