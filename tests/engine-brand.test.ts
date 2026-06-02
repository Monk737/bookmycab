import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SURFACES = [join(ROOT, "src/app/api/orgs"), join(ROOT, "src/app/webhooks")];
const FORBIDDEN = ["n8n", "workflow", "execution"];

function files(dir: string): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return []; }
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e);
    const st = lstatSync(full);
    if (st.isDirectory()) out.push(...files(full));
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

describe("engine API brand rule", () => {
  it("customer-facing route handlers contain no engine vocabulary", () => {
    const offenders: Array<{ file: string; terms: string[] }> = [];
    for (const f of SURFACES.flatMap(files)) {
      const content = readFileSync(f, "utf8").toLowerCase();
      const hit = FORBIDDEN.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(content));
      if (hit.length) offenders.push({ file: f, terms: hit });
    }
    expect(offenders).toEqual([]);
  });
});
