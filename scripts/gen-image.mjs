#!/usr/bin/env node
/**
 * Gemini image generation for impeccable design mocks + assets.
 *
 *   node scripts/gen-image.mjs "<prompt>" [outfile.png] [--model <id>] [--ar 16:9]
 *
 * Reads GEMINI_API_KEY from the environment, falling back to ~/.gemini/.env
 * (the Gemini CLI's standard location). The key is never stored in the repo.
 *
 * Default model: gemini-2.5-flash-image (a.k.a. "nano banana"). Swap with
 * --model gemini-3-pro-image / imagen-4.0-generate-001 for higher fidelity.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envFile = join(homedir(), ".gemini", ".env");
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, "utf8").match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

function parseArgs(argv) {
  const out = { prompt: null, outfile: "gen.png", model: "gemini-2.5-flash-image", ar: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--model") out.model = argv[++i];
    else if (argv[i] === "--ar") out.ar = argv[++i];
    else positional.push(argv[i]);
  }
  out.prompt = positional[0] ?? null;
  if (positional[1]) out.outfile = positional[1];
  return out;
}

const { prompt, outfile, model, ar } = parseArgs(process.argv.slice(2));
if (!prompt) {
  console.error('Usage: node scripts/gen-image.mjs "<prompt>" [outfile.png] [--model <id>] [--ar 16:9]');
  process.exit(1);
}
const apiKey = loadKey();
if (!apiKey) {
  console.error("No GEMINI_API_KEY found (env or ~/.gemini/.env).");
  process.exit(1);
}

const fullPrompt = ar ? `${prompt}\n\nAspect ratio: ${ar}.` : prompt;
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const res = await fetch(url, {
  method: "POST",
  headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  }),
});

if (!res.ok) {
  console.error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}

const data = await res.json();
const parts = data?.candidates?.[0]?.content?.parts ?? [];
const img = parts.find((p) => p.inlineData?.data);
if (!img) {
  const text = parts.find((p) => p.text)?.text;
  console.error("No image in response." + (text ? ` Model said: ${text.slice(0, 200)}` : ""));
  process.exit(1);
}

writeFileSync(outfile, Buffer.from(img.inlineData.data, "base64"));
console.log(`✓ ${outfile} (${model})`);
